import { test } from "node:test";
import assert from "node:assert/strict";
import { goldText, roundGold, signedGold } from "../lib/tools/format";

test(".5 rounds up on both sides of zero (comparison basis, PM 총괄 2026-10-14)", () => {
  assert.equal(signedGold(-1087.5), "−1,087");
  assert.equal(signedGold(1087.5), "+1,088");
  assert.equal(signedGold(-1087.51), "−1,088");
  assert.equal(signedGold(-1087.49), "−1,087");
  assert.equal(goldText(1087.5), "1,088");
  assert.equal(goldText(-1087.5), "-1,087");
});

test("zero shows no sign, and small values never show −0", () => {
  assert.equal(roundGold(-0.4), 0);
  assert.equal(Object.is(roundGold(-0.4), -0), false);
  assert.equal(signedGold(-0.4), "0");
  assert.equal(signedGold(-0.5), "0");
  assert.equal(signedGold(0), "0");
  assert.equal(signedGold(0.49), "0");
  assert.equal(signedGold(-0.51), "−1");
  assert.equal(signedGold(0.5), "+1");
});
