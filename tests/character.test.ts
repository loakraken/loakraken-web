import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import {
  characterNameError,
  evidenceAt,
  normalizeCharacterName,
  gradeKey,
  safeGameImage,
  safePortrait,
} from "../lib/character/model";
import { isCharacterEnvelope } from "../lib/character/validate";
import { requestCharacter, retryAt } from "../lib/character/upstream";

const fixtures = new URL("./fixtures/", import.meta.url);
const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(name, fixtures), "utf8"));
const full = () => ({
  code: "CHARACTER_SEARCH_SUCCESS",
  message: "성공",
  data: fixture("character-full-data.json"),
});
const reply = (body: unknown, status = 200, headers = {}) =>
  (async () => Response.json(body, { status, headers })) as typeof fetch;

test("all backend-generated fixtures satisfy the captured contract", () => {
  assert.equal(isCharacterEnvelope(full()), true);
  for (const name of readdirSync(fixtures).filter(
    (name) => name !== "character-full-data.json",
  )) {
    assert.equal(isCharacterEnvelope(fixture(name)), true, name);
  }
});

test("runtime contract rejects broken nested data and invalid collection time", () => {
  const bad = full();
  bad.data.loadout.gems.items = null;
  assert.equal(isCharacterEnvelope(bad), false);
  const missing = full();
  delete missing.data.coverage;
  assert.equal(isCharacterEnvelope(missing), false);
  const date = full();
  date.data.fetchedAt = "not a date";
  assert.equal(isCharacterEnvelope(date), false);
  const future = full();
  future.data.analysis.diagnostics.findings[0].code = "NEW_RULE";
  assert.equal(isCharacterEnvelope(future), true);
});

test("responses from a backend before the rollout fields still pass with neutral defaults", () => {
  const old = full();
  for (const key of ["tendencies", "decorations", "honorPoint", "townName", "townLevel", "guildMemberGrade", "avatars", "collectibles", "refreshAvailableAt", "skillPoints"])
    delete old.data[key];
  delete old.data.coverage.avatars;
  delete old.data.coverage.collectibles;
  delete old.data.analysis.position;
  for (const stat of old.data.stats) delete stat.tooltip;
  for (const effect of old.data.loadout.arkPassive?.effects ?? []) delete effect.effect;
  assert.equal(isCharacterEnvelope(old), true);
  assert.deepEqual(old.data.avatars, []);
  assert.deepEqual(old.data.collectibles, []);
  assert.equal(old.data.townName, null);
  assert.equal(old.data.coverage.avatars, "NOT_PROVIDED");
  assert.equal(old.data.analysis.position, null);
  const broken = full();
  broken.data.avatars = [{ name: "형식 오류" }];
  assert.equal(isCharacterEnvelope(broken), false, "present fields are still strict");
});

test("names share backend NFC, letters/numbers and UTF-16 length rules", () => {
  assert.equal(normalizeCharacterName("  가1  "), "가1");
  for (const name of ["모험가", "A1", "가".repeat(64), "𐐀1"])
    assert.equal(characterNameError(name), "");
  for (const name of [
    " ",
    "가".repeat(65),
    "name/name",
    "a b",
    "<script>",
    "%ED",
  ])
    assert.notEqual(characterNameError(name), "");
});

test("JSON Pointer evidence preserves zero, false, null and escaped property names", () => {
  const data = {
    data: { zero: 0, false: false, null: null, "a/b": { "~": "value" } },
  };
  for (const [key, value] of [
    ["zero", 0],
    ["false", false],
    ["null", null],
  ])
    assert.deepEqual(evidenceAt(data, `/data/${key}`), { found: true, value });
  assert.deepEqual(evidenceAt(data, "/data/a~1b/~0"), {
    found: true,
    value: "value",
  });
  for (const path of [
    "/data/missing",
    "/data/toString",
    "/data/__proto__",
    "/data/~2",
    "data/zero",
  ])
    assert.equal(evidenceAt(data, path).found, false);
});

test("portrait allowlist rejects deceptive hosts and credentials", () => {
  assert.equal(
    safePortrait("https://cdn-lostark.game.onstove.com/portrait.png"),
    "https://cdn-lostark.game.onstove.com/portrait.png",
  );
  for (const url of [
    null,
    "javascript:alert(1)",
    "http://localhost/test",
    "https://cdn-lostark.game.onstove.com.evil.test/x",
    "https://user:pass@lostark.game.onstove.com/x",
  ])
    assert.equal(safePortrait(url), null);
});

test("a successful lookup makes exactly one normalized backend request with no cache or redirects", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (input, options) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.pathname, "/api/v1/characters/search");
    assert.equal(url.searchParams.get("characterName"), "가1");
    assert.equal(url.searchParams.get("includeSiblings"), "false");
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.redirect, "error");
    assert.deepEqual(options?.headers, { Accept: "application/json" });
    return Response.json(full());
  };
  assert.equal(
    (await requestCharacter(" 가1 ", "http://localhost:8080", { fetcher })).ok,
    true,
  );
  assert.equal(calls, 1);
});

test("invalid names and missing/invalid origins never call a backend", async () => {
  const fetcher: typeof fetch = async () => {
    throw new Error("must not call");
  };
  assert.deepEqual(
    await requestCharacter("../bad", "http://localhost", { fetcher }),
    { ok: false, error: { code: "INVALID_REQUEST", status: 400 } },
  );
  for (const origin of [
    undefined,
    "",
    "file:///x",
    "https://host/path",
    "https://user:pass@host",
    "https://host?key=secret",
  ]) {
    assert.deepEqual(await requestCharacter("모험가", origin, { fetcher }), {
      ok: false,
      error: { code: "FRONTEND_API_NOT_CONFIGURED", status: 503 },
    });
  }
});

for (const [status, code] of [
  [400, "INVALID_REQUEST"],
  [404, "CHARACTER_NOT_FOUND"],
  [502, "LOST_ARK_API_ERROR"],
  [503, "LOST_ARK_NOT_CONFIGURED"],
  [503, "CHARACTER_CACHE_UNAVAILABLE"],
  [503, "CHARACTER_STORAGE_UNAVAILABLE"],
  [504, "LOST_ARK_API_TIMEOUT"],
] as const) {
  test(`upstream ${status} ${code} is safe and never retried`, async () => {
    let calls = 0;
    const result = await requestCharacter("모험가", "http://localhost", {
      fetcher: async () => {
        calls++;
        return Response.json(
          { code, message: "secret upstream details" },
          { status },
        );
      },
    });
    assert.deepEqual(result, { ok: false, error: { code, status } });
    assert.equal(calls, 1);
  });
}

test("429 uses Retry-After and does not retry; absent header defaults to 60 seconds", async () => {
  const now = Date.now();
  const result = await requestCharacter("모험가", "http://localhost", {
    fetcher: reply({ code: "LOST_ARK_RATE_LIMITED" }, 429, {
      "Retry-After": "60",
    }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.status, 429);
    assert.ok(result.error.retryAt! >= now + 60_000);
  }
  assert.equal(retryAt(null, 100), 60_100);
  assert.equal(retryAt("bogus", 100), 60_100);
  assert.equal(retryAt("Thu, 01 Jan 1970 00:02:00 GMT", 100), 120_000);
});

test("malformed JSON/shape and unrecognized HTTP failures never leak upstream text", async () => {
  for (const fetcher of [
    reply({ data: "bad" }),
    (async () => new Response("<html>secret</html>")) as typeof fetch,
  ]) {
    assert.deepEqual(
      await requestCharacter("모험가", "http://localhost", { fetcher }),
      { ok: false, error: { code: "INVALID_API_RESPONSE", status: 502 } },
    );
  }
  assert.deepEqual(
    await requestCharacter("모험가", "http://localhost", {
      fetcher: reply({ code: "secret", message: "secret" }, 500),
    }),
    { ok: false, error: { code: "LOST_ARK_API_ERROR", status: 502 } },
  );
});

test("timeout aborts the single request and reports 504", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (_, options) => {
    calls++;
    return new Promise((_, reject) => {
      const keepAlive = setTimeout(
        () => reject(new Error("test watchdog")),
        500,
      );
      options?.signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(keepAlive);
          reject(options.signal?.reason);
        },
        { once: true },
      );
    });
  };
  assert.deepEqual(
    await requestCharacter("모험가", "http://localhost", {
      fetcher,
      timeoutMs: 10,
    }),
    { ok: false, error: { code: "LOST_ARK_API_TIMEOUT", status: 504 } },
  );
  assert.equal(calls, 1);
});

test("timeout while reading the response body remains a timeout, not invalid JSON", async () => {
  const fetcher: typeof fetch = async (_, options) => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"code":'));
        const watchdog = setTimeout(() => controller.error(new Error("watchdog")), 500);
        options?.signal?.addEventListener("abort", () => {
          clearTimeout(watchdog);
          controller.error(options.signal?.reason);
        }, { once: true });
      },
    });
    return new Response(stream, { headers: { "Content-Type": "application/json" } });
  };
  assert.deepEqual(await requestCharacter("모험가", "http://localhost", { fetcher, timeoutMs: 10 }), {
    ok: false, error: { code: "LOST_ARK_API_TIMEOUT", status: 504 },
  });
});

test("game images allow only official armory/icon hosts and grades map to known tiles", () => {
  const icon =
    "https://cdn-lostark.game.onstove.com/efui_iconatlas/gbs_item/gbs_item_01_175.png";
  assert.equal(safeGameImage(icon), icon);
  for (const url of [
    undefined,
    "weapon.png",
    "http://cdn-lostark.game.onstove.com/x.png",
    "https://pica.korlark.com/efui_iconatlas/x.png",
    "https://cdn-lostark.game.onstove.com@evil.test/x.png",
  ])
    assert.equal(safeGameImage(url), null, String(url));
  assert.equal(gradeKey("고대"), "ancient");
  assert.equal(gradeKey(" 유물 "), "relic");
  assert.equal(gradeKey("에스더"), "esther");
  assert.equal(gradeKey("신화"), "unknown");
  assert.equal(gradeKey(null), "unknown");
});
