// Roster reads that stop early (PM-프론트 10-18 (d)): how many are left and
// when the button opens again, in whole minutes counted once.
import assert from "node:assert/strict";
import test from "node:test";
import { continueText, minutesUntil } from "../lib/character/continue-later";

test("minutes until the button opens: whole, at least one, one without a time", () => {
  const from = Date.parse("2026-10-19T03:00:00Z");
  assert.equal(minutesUntil("2026-10-19T03:01:00Z", from), 1);
  assert.equal(minutesUntil("2026-10-19T03:00:20Z", from), 1);
  assert.equal(minutesUntil("2026-10-19T03:09:31Z", from), 10);
  assert.equal(minutesUntil("2026-10-19T02:59:00Z", from), 1);
  assert.equal(minutesUntil(null, from), 1);
  assert.equal(minutesUntil("not a time", from), 1);
});

test("the line: some left, none read this time, or none left", () => {
  assert.equal(continueText(4, 8, 1), "4명 남음 · 1분 뒤 이어서 불러올 수 있어요");
  assert.equal(continueText(12, 0, 1), "지금은 불러오지 못했어요 · 1분 뒤 다시 눌러 주세요");
  assert.equal(continueText(1, 11, 10, "채울"), "1명 남음 · 10분 뒤 이어서 채울 수 있어요");
  assert.equal(continueText(0, 12, 1), null);
});
