import assert from "node:assert/strict";
import test from "node:test";
import { HOUR, MINUTE, SECOND, remainingStep, remainingText } from "../lib/time/remaining";
import { countdownText, retryLabel } from "../lib/api/rate-limit";

test("one format for time left: days, hours, then minutes with seconds", () => {
  assert.equal(remainingText(3 * 86_400_000 + 11 * HOUR + 29 * MINUTE), "3일 11시간");
  assert.equal(remainingText(86_400_000), "1일 0시간");
  assert.equal(remainingText(5 * HOUR + 30 * MINUTE + 59 * SECOND), "5시간 30분");
  assert.equal(remainingText(HOUR), "1시간 0분");
  // Under an hour: never "0시간 25분" (user, 19:32), seconds as two digits.
  assert.equal(remainingText(25 * MINUTE + 3 * SECOND), "25분 03초");
  assert.equal(remainingText(HOUR - SECOND), "59분 59초");
  assert.equal(remainingText(45 * SECOND + 900), "45초");
  assert.equal(remainingText(0), "0초");
  assert.equal(remainingText(-1), null);
  assert.equal(remainingText(Number.NaN), null);
});

test("seconds clock only in the last hour (plus one minute of slack)", () => {
  assert.equal(remainingStep(2 * HOUR), MINUTE);
  assert.equal(remainingStep(HOUR + 2 * MINUTE), MINUTE);
  assert.equal(remainingStep(HOUR + 30 * SECOND), SECOND);
  assert.equal(remainingStep(10 * MINUTE), SECOND);
});

test("rate-limit waits use the same format", () => {
  assert.equal(countdownText(30), "30초 뒤 다시 시도해 주세요.");
  assert.equal(countdownText(75), "1분 15초 뒤 다시 시도해 주세요.");
  assert.equal(retryLabel(125), "2분 05초 뒤 다시 시도");
});
