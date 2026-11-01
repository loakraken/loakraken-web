import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { isUserKeyCode, keyHint, MAX_KEY_LENGTH, normalizeUserKey } from "../lib/byok/key";
import { sealSecret, sealUserKey, unsealUserKey } from "../lib/byok/seal";
import { forwardContext, forwardHeaders } from "../lib/api/backend";
import { requestCharacter } from "../lib/character/upstream";
import { requestSiblings } from "../lib/character/related";

const KEY = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2lnbmF0dXJl";

test("key shape: three base64url parts, trimmed, bounded (same rule as the api)", () => {
  assert.equal(normalizeUserKey(`  ${KEY}\n`), KEY);
  for (const bad of ["", "abc", "a.b", "a.b.c.d", "a.b.c d", "a.b.c=", `a.b.${"c".repeat(MAX_KEY_LENGTH)}`, 42, null])
    assert.equal(normalizeUserKey(bad), null, String(bad));
});

test("hint shows only the last four characters", () => {
  assert.equal(keyHint(KEY), "…dXJl");
  assert.equal(keyHint(KEY).includes(KEY.slice(0, 8)), false);
});

test("user key codes from the api", () => {
  for (const code of ["USER_KEY_MALFORMED", "USER_KEY_INVALID", "USER_KEY_RATE_LIMITED"]) assert.equal(isUserKeyCode(code), true);
  for (const code of ["LOST_ARK_RATE_LIMITED", undefined, ""]) assert.equal(isUserKeyCode(code), false);
});

test("seal: round trip, and the sealed text never contains the key", () => {
  const secret = randomBytes(32);
  const until = new Date(Date.now() + 60_000);
  const sealed = sealUserKey(KEY, until, secret);
  assert.match(sealed, /^v1\.[A-Za-z0-9_-]+$/);
  assert.equal(sealed.includes(KEY), false);
  assert.equal(sealed.includes(KEY.split(".")[1]), false);
  assert.deepEqual(unsealUserKey(sealed, secret), { key: KEY, expiresAt: new Date(until.getTime()) });
  // A fresh IV each time: two seals of the same key differ.
  assert.notEqual(sealUserKey(KEY, until, secret), sealed);
});

test("seal: altered, other secret (rotated), expired or malformed → no key", () => {
  const secret = randomBytes(32);
  const sealed = sealUserKey(KEY, new Date(Date.now() + 60_000), secret);
  const flipped = sealed.slice(0, -2) + (sealed.at(-2) === "A" ? "B" : "A") + sealed.at(-1);
  assert.equal(unsealUserKey(flipped, secret), null);
  assert.equal(unsealUserKey(sealed, randomBytes(32)), null);
  assert.equal(unsealUserKey(sealUserKey(KEY, new Date(Date.now() - 1), secret), secret), null);
  for (const bad of [undefined, null, "", "v1.", "v2.abcd", "v1.AAAA", KEY]) assert.equal(unsealUserKey(bad, secret), null, String(bad));
});

test("a key header sent by the browser is never forwarded to the api (보안 R5)", () => {
  const incoming = new Headers({ "x-lk-user-key": KEY, "x-request-id": "abcdefgh-1234", "user-agent": "Mozilla/5.0" });
  const forwarded = forwardHeaders(forwardContext(incoming));
  assert.equal(Object.keys(forwarded).some((name) => name.toLowerCase() === "x-lk-user-key"), false);
  assert.equal(JSON.stringify(forwarded).includes(KEY), false);
});

const context = { forwardedFor: null, requestId: "test-request-1", bot: false };
const answer = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

test("character search: the key header only when given; user-key codes pass through", async () => {
  const seen: (string | null)[] = [];
  const fetcher = (async (_url: URL, init: RequestInit) => {
    seen.push(new Headers(init.headers).get("x-lk-user-key"));
    return answer(401, { code: "USER_KEY_INVALID", message: "x", data: null });
  }) as typeof fetch;
  const withKey = await requestCharacter("상세", "http://backend.test", { fetcher, headers: { "X-LK-User-Key": KEY } });
  const without = await requestCharacter("상세", "http://backend.test", { fetcher });
  assert.deepEqual(seen, [KEY, null]);
  assert.deepEqual(withKey, { ok: false, error: { code: "USER_KEY_INVALID", status: 401 } });
  assert.equal(without.ok, false);
  // The key's own limit stays its own (not our LOST_ARK_RATE_LIMITED), with its wait.
  const limited = await requestCharacter("상세", "http://backend.test", {
    fetcher: (async () => answer(429, { code: "USER_KEY_RATE_LIMITED", message: "x", data: null }, { "Retry-After": "30" })) as typeof fetch,
  });
  assert.equal(limited.ok, false);
  if (!limited.ok) {
    assert.equal(limited.error.code, "USER_KEY_RATE_LIMITED");
    assert.ok(limited.error.retryAt && limited.error.retryAt > Date.now() + 25_000);
  }
  const malformed = await requestCharacter("상세", "http://backend.test", {
    fetcher: (async () => answer(400, { code: "USER_KEY_MALFORMED", message: "x", data: null })) as typeof fetch,
  });
  assert.equal(!malformed.ok && malformed.error.code, "USER_KEY_MALFORMED");
});

test("siblings: the key header only when given; user-key codes pass through", async () => {
  const seen: (string | null)[] = [];
  const fetcher = (async (_url: URL, init: RequestInit) => {
    seen.push(new Headers(init.headers).get("x-lk-user-key"));
    return answer(429, { code: "USER_KEY_RATE_LIMITED", message: "x", data: null }, { "Retry-After": "12" });
  }) as typeof fetch;
  const withKey = await requestSiblings("상세", "http://backend.test", { fetcher, context, headers: { "X-LK-User-Key": KEY } } as never);
  await requestSiblings("상세", "http://backend.test", { fetcher, context } as never);
  assert.deepEqual(seen, [KEY, null]);
  assert.equal(!withKey.ok && withKey.error.code, "USER_KEY_RATE_LIMITED");
});

test("seal secret: exactly 32 bytes of base64, else none", () => {
  assert.equal(sealSecret(randomBytes(32).toString("base64"))?.length, 32);
  for (const bad of [undefined, null, "", "c2hvcnQ=", randomBytes(16).toString("base64")]) assert.equal(sealSecret(bad), null);
});
