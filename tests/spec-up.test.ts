import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NO_EDITS } from "../lib/combat-power/model";
import { costRoom, editsFor, keepOrder, koreanGold, readTry, splitCandidates, tryParam } from "../lib/spec-up/model";
import { requestSpecUp } from "../lib/spec-up/upstream";
import { isSpecUpEnvelope } from "../lib/spec-up/validate";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./spec-up-fixtures/${name}`, import.meta.url), "utf8"));

test("gold reads in Korean units with every digit kept", () => {
  assert.equal(koreanGold(0), "0");
  assert.equal(koreanGold(850), "850");
  assert.equal(koreanGold(10_000), "1만");
  assert.equal(koreanGold(12_340), "1만 2,340");
  assert.equal(koreanGold(620_000), "62만");
  assert.equal(koreanGold(2_620_000), "262만");
  assert.equal(koreanGold(123_456_789), "1억 2,345만 6,789");
  assert.equal(koreanGold(-5_000), "−5,000");
});

test("a cost cell holds the room of a longer cost of the same size", () => {
  assert.equal(costRoom(620_000), "888만 8,888G");
  assert.equal(costRoom(2_620_000), "8,888만 8,888G");
  assert.equal(costRoom(12_340_000), "88,888만 8,888G");
  assert.equal(costRoom(5_000), "8만 8,888G");
  assert.equal(costRoom(123_456_789), "88억 8,888만 8,888G");
  // ×1.37 of the original stays within the room (as wide or narrower).
  for (const a of [620_000, 2_620_000, 9_000, 75_000_000])
    assert.ok(`${koreanGold(Math.round(a * 1.37) + 9_400)}G`.length <= costRoom(a).length, String(a));
});

test("a refresh keeps listed rows in place; new ones follow, a new sort starts over", () => {
  const rows = fixture("character-spec-up.json").data.candidates.slice(0, 3);
  const [a, b, c] = rows;
  // The backend now ranks c first: the rows on screen stay a, b, c.
  assert.deepEqual(keepOrder([c, a, b], [a.id, b.id, c.id]).map((r) => r.id), [a.id, b.id, c.id]);
  // A candidate not shown before goes after them, one gone is simply left out.
  assert.deepEqual(keepOrder([c, a], [a.id, b.id]).map((r) => r.id), [a.id, c.id]);
  assert.deepEqual(keepOrder([c, a, b], null).map((r) => r.id), [c.id, a.id, b.id]);
});

test("backend samples pass the contract, a changed code does not", () => {
  for (const name of ["character-spec-up.json", "character-spec-up-pending.json"])
    assert.ok(isSpecUpEnvelope(fixture(name)), name);
  assert.equal(isSpecUpEnvelope({ ...fixture("character-spec-up.json"), code: "OTHER" }), false);
  // A new kind or status string is not a contract break.
  const added = fixture("character-spec-up.json");
  added.data.candidates[0].kind = "NEW_KIND";
  added.data.candidates[0].cost.status = "ESTIMATED";
  assert.ok(isSpecUpEnvelope(added));
});

test("OK rows keep the backend order; the rest fold one line per reason", () => {
  const { candidates } = fixture("character-spec-up.json").data;
  const { ok, folded } = splitCandidates(candidates);
  assert.deepEqual(ok.map((c) => c.id), ["GEM_LEVEL:0:9", "GEM_LEVEL:0:10", "EQUIPMENT_QUALITY:0:100"]);
  const model = folded.find((f) => f.code === "MODEL_UNCONFIRMED");
  assert.ok(model);
  assert.ok(model.kinds.includes("재련") && model.kinds.includes("카르마"));
  assert.equal(new Set(folded.map((f) => f.code)).size, folded.length, "one line per reason code");
  assert.equal(
    folded.reduce((n, f) => n + f.candidates.length, 0) + ok.length,
    candidates.length,
    "no candidate is lost",
  );
});

test("적용해 보기 turns a change into simulator inputs, through the URL", () => {
  const gem = { kind: "GEM_LEVEL", slot: 0, index: null, level: 10, refine: null, quality: null, name: null };
  assert.deepEqual(editsFor(readTry(tryParam(gem)), NO_EDITS)?.gems, { 0: 10 });
  const quality = { ...gem, kind: "EQUIPMENT_QUALITY", slot: null, level: null, index: 0, quality: 100 };
  assert.deepEqual(editsFor(quality, NO_EDITS)?.quality, { 0: 100 });
  const engraving = { ...gem, kind: "ENGRAVING_LEVEL", slot: null, level: 4, name: "원한" };
  assert.deepEqual(editsFor(engraving, NO_EDITS)?.engraving, { 원한: 4 });
  assert.equal(editsFor({ ...gem, kind: "EQUIPMENT_REFINE", refine: 21 }, NO_EDITS), null, "refine is not editable yet");
  assert.equal(editsFor(null, NO_EDITS), null);
  assert.equal(readTry("{"), null);
  assert.equal(readTry(JSON.stringify({ slot: 1 })), null);
  assert.equal(readTry(JSON.stringify({ kind: "GEM_LEVEL", slot: "0", level: 10 }))?.slot, null);
});

test("the proxy checks the name and sends sort and limit", async () => {
  assert.deepEqual(await requestSpecUp("", null, "http://backend.test"), {
    ok: false,
    error: { code: "INVALID_REQUEST", status: 400 },
  });
  let seen = "";
  const fetcher = (async (url: URL | string) => {
    seen = String(url);
    return new Response(JSON.stringify(fixture("character-spec-up.json")), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  const result = await requestSpecUp("스펙캐시", "DELTA", "http://backend.test", { fetcher });
  assert.equal(result.ok, true);
  const url = new URL(seen);
  assert.equal(url.pathname, "/api/v1/characters/spec-up");
  assert.equal(url.searchParams.get("characterName"), "스펙캐시");
  assert.equal(url.searchParams.get("sort"), "DELTA");
  assert.equal(url.searchParams.get("limit"), "50");
  await requestSpecUp("스펙캐시", "WRONG", "http://backend.test", { fetcher });
  assert.equal(new URL(seen).searchParams.get("sort"), null, "an unknown sort is not forwarded");
});

test("disabled and not-cached answers keep their codes", async () => {
  for (const [name, code] of [
    ["character-spec-up-disabled.json", "SPEC_UP_DISABLED"],
    ["character-spec-up-not-cached.json", "CHARACTER_NOT_CACHED"],
  ] as const) {
    const fetcher = (async () =>
      new Response(JSON.stringify(fixture(name)), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
    const result = await requestSpecUp("스펙캐시", null, "http://backend.test", { fetcher });
    assert.deepEqual(result.ok ? null : result.error.code, code);
  }
});
