import assert from "node:assert/strict";
import test from "node:test";
import { awakeningLabel } from "../lib/character/skill-type";

test("skill type: 각성기 and 초각성 marked, everything else a normal skill", () => {
  assert.equal(awakeningLabel(1), "각성기");
  // 100/101: not told apart until the mapping is confirmed.
  assert.equal(awakeningLabel(100), "초각성");
  assert.equal(awakeningLabel(101), "초각성");
  for (const value of [0, 2, 99, 102, -1, null, undefined]) assert.equal(awakeningLabel(value), null, String(value));
});
