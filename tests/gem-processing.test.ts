import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  groupByGem,
  missingText,
  parseGemRankingRequest,
  pheonField,
  rankingRequest,
  resetTicketField,
  wayText,
} from "../lib/combat-power/gem-processing";
import { isGemRankingEnvelope } from "../lib/combat-power/validate";
import { requestGemRanking } from "../lib/combat-power/upstream";
import { isGemRankingEnabled } from "../lib/tools/flags";

// The api's CI sample (api #1111 83598e2a, artifact openapi-contract), as the mock serves it.
const sample = () => JSON.parse(readFileSync(new URL("./combat-power-fixtures/gem-ranking.json", import.meta.url), "utf8"));

test("the api's sample passes the contract check; another code or no rows does not", () => {
  assert.equal(isGemRankingEnvelope(sample()), true);
  assert.equal(isGemRankingEnvelope({ ...sample(), code: "CHARACTER_COMBAT_POWER_SIMULATE_SUCCESS" }), false);
  const noRows = sample();
  delete noRows.data.rows;
  assert.equal(isGemRankingEnvelope(noRows), false);
});

test("allow-list: name rule, 영웅 · 희귀, known policies once each, prices in range, limit 1–200", () => {
  assert.deepEqual(parseGemRankingRequest({ characterName: "모험가", grade: "HERO", prices: { pheonGold: 70 }, extra: 1 }), {
    characterName: "모험가",
    grade: "HERO",
    prices: { pheonGold: 70 },
    limit: 200,
  });
  for (const bad of [
    { characterName: "모험가", grade: "UNCOMMON" },
    { characterName: "", grade: "HERO" },
    { characterName: "모험가", grade: "HERO", policies: ["ALL", "ALL"] },
    { characterName: "모험가", grade: "HERO", policies: ["SOME"] },
    { characterName: "모험가", grade: "HERO", reset: [true, true] },
    { characterName: "모험가", grade: "HERO", prices: { resetTicketGold: 10_000_001 } },
    { characterName: "모험가", grade: "HERO", prices: { pheonGold: -1 } },
    { characterName: "모험가", grade: "HERO", limit: 201 },
    null,
  ])
    assert.equal(parseGemRankingRequest(bad), null, JSON.stringify(bad));
});

test("the proxy refuses before any backend call, and passes the api's answer on", async () => {
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    return new Response(JSON.stringify(sample()), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  assert.deepEqual(await requestGemRanking({ characterName: "모험가", grade: "UNCOMMON" }, "http://127.0.0.1:8080", { fetcher }), {
    ok: false,
    error: { code: "INVALID_REQUEST", status: 400 },
  });
  assert.equal(calls, 0);
  assert.equal((await requestGemRanking({ characterName: "모험가", grade: "HERO" }, "http://127.0.0.1:8080", { fetcher })).ok, true);
  assert.equal(calls, 1);
});

test("the page's request: prices only when typed (empty = none, no default), every row", () => {
  assert.deepEqual(rankingRequest("모험가", "HERO", null, null), { characterName: "모험가", grade: "HERO", limit: 200 });
  assert.deepEqual(rankingRequest("모험가", "RARE", 59110, 72), {
    characterName: "모험가",
    grade: "RARE",
    prices: { resetTicketGold: 59110, pheonGold: 72 },
    limit: 200,
  });
  assert.deepEqual(resetTicketField(""), { value: null, invalid: false });
  assert.deepEqual(resetTicketField("59,110"), { value: 59110, invalid: false });
  assert.deepEqual(resetTicketField("1.5"), { value: null, invalid: true });
  assert.deepEqual(pheonField("100001"), { value: null, invalid: true });
});

test("typed prices: 페온 up to two decimal places, 초기화권 whole; nothing stripped silently (web #1971)", () => {
  for (const [text, value] of [
    ["72.5", 72.5],
    ["1,234.56", 1234.56],
    [" 0.05 ", 0.05],
    ["100000", 100000],
    ["100,000.00", 100000],
  ] as const)
    assert.deepEqual(pheonField(text), { value, invalid: false }, text);
  for (const text of ["1.234", "1.", ".5", "-1", "+1", "1e3", "1,2,3", "12,34.5", "1 000", "100000.01", "72.5G"])
    assert.deepEqual(pheonField(text), { value: null, invalid: true }, text);
  for (const text of ["1.5", "1,2,3", "-1", "59110.0"])
    assert.deepEqual(resetTicketField(text), { value: null, invalid: true }, text);
  assert.deepEqual(resetTicketField("10,000,000"), { value: 10_000_000, invalid: false });
  // The proxy: 페온 a number, 초기화권 a whole number (int64 in the contract).
  assert.deepEqual(parseGemRankingRequest({ characterName: "모험가", grade: "HERO", prices: { pheonGold: 72.5 } })?.prices, { pheonGold: 72.5 });
  assert.equal(parseGemRankingRequest({ characterName: "모험가", grade: "HERO", prices: { resetTicketGold: 59110.5 } }), null);
});

test("rows grouped per worn gem (0-based slot · gem), each gem's best row first, in the api's order", () => {
  const groups = groupByGem(sample().data.rows);
  assert.deepEqual(
    groups.map((g) => [g.key, g.best.rank, g.others.length]),
    [
      ["5:1", 1, 7],
      ["5:2", 6, 3],
      ["5:0", 11, 3],
      ["5:3", 17, 11],
    ],
  );
  assert.equal(groups.reduce((n, g) => n + 1 + g.others.length, 0), 28);
});

test("words: the way to process, missing prices; an unknown policy shows its code", () => {
  assert.equal(wayText({ policy: "A_OR_B", targetTotal: 16, reset: false }), "주요 효과 하나 이상 · 포인트 합 16 이상");
  assert.equal(wayText({ policy: "ALL", targetTotal: 17, reset: true }), "효과 상관없이 · 포인트 합 17 이상 · 초기화 사용");
  assert.equal(wayText({ policy: "NEW_ONE", targetTotal: 5, reset: false }), "NEW_ONE · 포인트 합 5 이상");
  assert.equal(missingText(["GEM", "PHEON"]), "젬 시세 · 페온 1개 골드");
});

test("GEM_RANKING: off unless set on, and only with the simulator", () => {
  assert.equal(isGemRankingEnabled({}), false);
  assert.equal(isGemRankingEnabled({ GEM_RANKING: "on" }), true);
  assert.equal(isGemRankingEnabled({ GEM_RANKING: "on", COMBAT_POWER_SIM: "off" }), false);
});
