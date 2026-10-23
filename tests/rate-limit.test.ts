// 429 notice (PM criteria 2026-10-09): same copy on every screen, seconds left
// from Retry-After, the code name never shown, no automatic retry.
import assert from "node:assert/strict";
import test from "node:test";
import {
  RATE_LIMITED,
  countdownText,
  failureOf,
  rateLimitCopy,
  retryLabel,
  secondsUntil,
} from "../lib/api/rate-limit";
import { requestBackend } from "../lib/api/backend";
import { failureCopy } from "../lib/character/model";
import { marketFailureCopy } from "../lib/market/model";

test("the alert sentence is fixed; only the note and button count down", () => {
  const now = 1_000_000;
  assert.equal(secondsUntil(now + 29_200, now), 30);
  assert.equal(secondsUntil(now - 1, now), 0);
  assert.equal(secondsUntil(undefined, now), 0);
  // Fixed, so a live region reads it once (no number in it).
  assert.deepEqual(rateLimitCopy(), {
    title: "요청이 많아 잠시 쉬어 가요",
    text: "잠시 뒤 다시 시도해 주세요.",
  });
  assert.equal(countdownText(30), "30초 뒤 다시 시도해 주세요.");
  assert.equal(countdownText(0), "이제 다시 시도할 수 있어요.");
  assert.equal(retryLabel(5), "5초 뒤 다시 시도");
  assert.equal(retryLabel(0, "다시 불러오기"), "다시 불러오기");
  for (const copy of [
    failureCopy({ code: RATE_LIMITED, status: 429, retryAt: now + 10_000 }),
    marketFailureCopy({ code: RATE_LIMITED, status: 429, retryAt: now + 10_000 }),
  ]) {
    assert.deepEqual(copy, rateLimitCopy());
    assert.doesNotMatch(`${copy.title} ${copy.text}`, /RATE_LIMITED|429|d/);
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
  // Marked as this visitor's own share, for the other words below.
  assert.equal(result.error.limit, "client");
});

test("the visitor's own share reads as a short pause; the site-wide limit keeps its words", async () => {
  const site = (async () =>
    Response.json({ code: "LOST_ARK_RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "30" } })) as unknown as typeof fetch;
  const result = await requestBackend(new URL("http://127.0.0.1:8080/x"), {
    isValid: (body): body is unknown => body !== undefined,
    errorCodes: { 429: ["LOST_ARK_RATE_LIMITED"] },
    fetcher: site,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.limit, undefined);

  const pause = { title: "짧은 시간에 검색이 많아 잠깐 쉬어 가요", text: "잠시 뒤 다시 시도해 주세요." };
  const client = { code: RATE_LIMITED, status: 429, retryAt: Date.now() + 10_000, limit: "client" as const };
  assert.deepEqual(rateLimitCopy({ limit: "client" }), pause);
  assert.deepEqual(rateLimitCopy({ code: "CLIENT_RATE_LIMITED" }), pause);
  assert.deepEqual(failureCopy(client), pause);
  assert.deepEqual(marketFailureCopy(client), pause);
  assert.deepEqual(rateLimitCopy(result.error), rateLimitCopy());
  assert.notDeepEqual(rateLimitCopy(), pause);
});

test("failureOf reads the info a client query error carries", () => {
  assert.deepEqual(failureOf({ info: { code: RATE_LIMITED, retryAt: 5 } }), { code: RATE_LIMITED, retryAt: 5 });
  assert.equal(failureOf(new Error("x")), null);
  assert.equal(failureOf(null), null);
  assert.equal(failureOf({ info: { code: 3 } }), null);
});
