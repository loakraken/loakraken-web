// 429 notice (PM criteria 2026-10-09): same copy on every screen, seconds left
// from Retry-After, the code name never shown, no automatic retry.
import assert from "node:assert/strict";
import test from "node:test";
import {
  RATE_LIMITED,
  failureOf,
  rateLimitCopy,
  retryLabel,
  secondsUntil,
} from "../lib/api/rate-limit";
import { requestBackend } from "../lib/api/backend";
import { failureCopy } from "../lib/character/model";
import { marketFailureCopy } from "../lib/market/model";

test("copy counts down from Retry-After and never names the code", () => {
  const now = 1_000_000;
  assert.equal(secondsUntil(now + 29_200, now), 30);
  assert.equal(secondsUntil(now - 1, now), 0);
  assert.equal(secondsUntil(undefined, now), 0);
  assert.deepEqual(rateLimitCopy(30), {
    title: "요청이 많아 잠시 쉬어 가요",
    text: "30초 뒤 다시 시도해 주세요.",
  });
  assert.equal(rateLimitCopy(0).text, "이제 다시 시도할 수 있어요.");
  assert.equal(retryLabel(5), "5초 뒤 다시 시도");
  assert.equal(retryLabel(0, "다시 불러오기"), "다시 불러오기");
  for (const copy of [
    failureCopy({ code: RATE_LIMITED, status: 429, retryAt: now + 10_000 }, now),
    marketFailureCopy({ code: RATE_LIMITED, status: 429, retryAt: now + 10_000 }, now),
  ]) {
    assert.equal(copy.text, "10초 뒤 다시 시도해 주세요.");
    assert.doesNotMatch(`${copy.title} ${copy.text}`, /RATE_LIMITED|429/);
  }
});

test("the per-client 429 (CLIENT_RATE_LIMITED) is reported like any 429", async () => {
  const fetcher = (async () =>
    Response.json({ code: "CLIENT_RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "30" } })) as unknown as typeof fetch;
  const before = Date.now();
  const result = await requestBackend(new URL("http://127.0.0.1:8080/x"), {
    isValid: (body): body is unknown => body !== undefined,
    errorCodes: { 429: ["LOST_ARK_RATE_LIMITED"] },
    fetcher,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, RATE_LIMITED);
  assert.ok((result.error.retryAt ?? 0) >= before + 30_000);
});

test("failureOf reads the info a client query error carries", () => {
  assert.deepEqual(failureOf({ info: { code: RATE_LIMITED, retryAt: 5 } }), { code: RATE_LIMITED, retryAt: 5 });
  assert.equal(failureOf(new Error("x")), null);
  assert.equal(failureOf(null), null);
  assert.equal(failureOf({ info: { code: 3 } }), null);
});
