import assert from "node:assert/strict";
import test from "node:test";
import { awakeningLabel, isAwakeningPair } from "../lib/character/skill-type";

test("skill type: real raw codes — 100 각성기, 101 초각성기, 1 초각성 스킬, everything else a normal skill", () => {
  assert.equal(awakeningLabel(100), "각성기");
  assert.equal(awakeningLabel(101), "초각성기");
  assert.equal(awakeningLabel(1), "초각성 스킬");
  for (const value of [0, 2, 99, 102, -1, null, undefined]) assert.equal(awakeningLabel(value), null, String(value));
});

test("skill type: only 각성기·초각성기 come in pairs whose equipped one is unknown", () => {
  assert.equal(isAwakeningPair(100), true);
  assert.equal(isAwakeningPair(101), true);
  for (const value of [0, 1, 2, null, undefined]) assert.equal(isAwakeningPair(value), false, String(value));
});
