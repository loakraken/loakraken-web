import assert from "node:assert/strict";
import test from "node:test";
import { CHAOS_GATE_GOLD, chaosGateGold, chaosGateGoldLabel } from "../lib/home/chaos-gate-gold";

test("카오스게이트 clear gold: only the agreed band has a number, each with sources", () => {
  assert.deepEqual(
    CHAOS_GATE_GOLD.map(({ from, to, gold }) => [from, to, gold]),
    [[1720, 1729, 3000]],
  );
  for (const band of CHAOS_GATE_GOLD) assert.ok(band.source.length >= 2);
});

test("카오스게이트 clear gold: a group takes the amount only when its whole range sits in the band", () => {
  assert.equal(chaosGateGold(1720, 1730), 3000);
  assert.equal(chaosGateGold(1725, 1728), 3000);
  // 1720 up to 1749 spans two bands: no amount.
  assert.equal(chaosGateGold(1720, 1750), null);
  // The top group has no upper bound: no amount.
  assert.equal(chaosGateGold(1720, null), null);
  assert.equal(chaosGateGold(1680, 1720), null);
  assert.equal(chaosGateGold(1730, 1750), null);
  assert.equal(chaosGateGold(null, 1730), null);
});

test("카오스게이트 clear gold label", () => {
  assert.equal(chaosGateGoldLabel(3000), "골드 3,000");
  assert.equal(chaosGateGoldLabel(null), "골드");
});
