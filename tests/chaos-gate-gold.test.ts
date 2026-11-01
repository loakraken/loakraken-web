import assert from "node:assert/strict";
import test from "node:test";
import { CHAOS_GATE_GOLD, chaosGateGold, chaosGateGoldNote } from "../lib/home/chaos-gate-gold";

test("카오스게이트 clear gold: only the agreed band has a number, each with sources", () => {
  assert.deepEqual(
    CHAOS_GATE_GOLD.map(({ from, to, gold }) => [from, to, gold]),
    [[1720, 1729, 3000]],
  );
  for (const band of CHAOS_GATE_GOLD) assert.ok(band.source.length >= 2);
});

test("카오스게이트 clear gold: a group takes the amount only when its whole range sits in the band", () => {
  assert.equal(chaosGateGold(1720, 1730)?.gold, 3000);
  assert.equal(chaosGateGold(1725, 1728)?.gold, 3000);
  // 1720 up to 1749 spans two bands: no amount.
  assert.equal(chaosGateGold(1720, 1750), null);
  // The top group has no upper bound: no amount.
  assert.equal(chaosGateGold(1720, null), null);
  assert.equal(chaosGateGold(1680, 1720), null);
  assert.equal(chaosGateGold(1730, 1750), null);
  assert.equal(chaosGateGold(null, 1730), null);
});

test("카오스게이트 clear gold note", () => {
  assert.equal(chaosGateGoldNote(chaosGateGold(1720, 1730)!), "클리어 골드 3,000(캐릭터 귀속, 2025년 12월 기준)");
});
