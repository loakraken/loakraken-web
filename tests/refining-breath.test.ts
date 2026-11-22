// M41 (PM 총괄 11-22 13:40): per part, 숨결 없이 vs 숨결 최대 for the same target, each side valued at market
// (누골 + every material at its unit price, owned ones too), and one breath's value = (no-breath total − with-breath
// total with breath at 0G) ÷ expected breaths, against the breath's market price.
import assert from "node:assert/strict";
import test from "node:test";
import { breathCompare } from "../lib/refining/breath";
import type { Plan } from "../lib/refining/model";
import type { MaterialPrice } from "../lib/market/model";

const stage = (gold: number, materials: [string, number][]) =>
  ({
    targetStage: 21,
    expectedAttempts: 10,
    medianAttempts: 8,
    p90Attempts: 20,
    maxAttempts: 25,
    expectedMaterials: materials.map(([name, amount]) => ({ name, amount })),
    worstCaseMaterials: materials.map(([name, amount]) => ({ name, amount: amount * 2.5 })),
    expectedGold: gold,
    worstCaseGold: gold * 2.5,
  }) as unknown as Plan["stages"][number];
const plan = (gold: number, materials: [string, number][]) => ({ stages: [stage(gold, materials)] }) as unknown as Plan;
const price = (name: string, unit: number | null): MaterialPrice =>
  ({ name, status: unit == null ? "PRICE_UNAVAILABLE" : "PRICED", unitPriceGold: unit }) as MaterialPrice;

const prices = [price("운명의 수호석", 0.3), price("운명의 파편", 0.1), price("빙하의 숨결", 400)];

test("both sides at market, the cheaper one, and one breath's value against its price", () => {
  // 숨결 없이: 누골 20,000 + 수호석 30,000 × 0.3 + 파편 100,000 × 0.1 = 39,000
  const without = plan(20_000, [["운명의 수호석", 30_000], ["운명의 파편", 100_000]]);
  // 숨결 최대: 누골 12,000 + 수호석 18,000 × 0.3 + 파편 60,000 × 0.1 + 숨결 20 × 400 = 31,400 (숨결 0G면 23,400)
  const withBreath = plan(12_000, [["운명의 수호석", 18_000], ["운명의 파편", 60_000], ["빙하의 숨결", 20]]);
  const c = breathCompare(without, withBreath, "expected", prices)!;
  assert.equal(c.without.nugol, 20_000);
  assert.equal(c.without.total, 39_000);
  assert.equal(c.with.total, 31_400);
  assert.equal(c.with.breaths, 20);
  assert.equal(c.cheaper, "with");
  // (39,000 − 23,400) ÷ 20 = 780 per breath, market 400 → buying is worth it.
  assert.equal(c.breathValue, 780);
  assert.equal(c.breathPrice, 400);
  assert.equal(c.verdict, "BUY");
  assert.deepEqual(c.unpriced, []);
});

test("a breath worth less than its price: skip it; the mode's attempts scale the amounts", () => {
  const without = plan(10_000, [["운명의 파편", 50_000]]); // 15,000
  const withBreath = plan(9_000, [["운명의 파편", 45_000], ["빙하의 숨결", 20]]); // 13,500 + 8,000 = 21,500; 0G: 13,500
  const c = breathCompare(without, withBreath, "expected", prices)!;
  assert.equal(c.cheaper, "without");
  assert.equal(c.breathValue, 75); // (15,000 − 13,500) ÷ 20
  assert.equal(c.verdict, "SKIP");
  // 장인의 기운 (max): worst-case materials and gold (× 2.5 here).
  const worst = breathCompare(without, withBreath, "max", prices)!;
  assert.equal(worst.without.total, 37_500);
  assert.equal(worst.with.breaths, 50);
});

test("no breath price: no verdict; unpriced other materials are left out of both sides and named", () => {
  const without = plan(10_000, [["운명의 파편", 50_000], ["재봉술 : 업화 [19-20]", 10]]);
  const withBreath = plan(9_000, [["운명의 파편", 45_000], ["용암의 숨결", 20], ["재봉술 : 업화 [19-20]", 8]]);
  const c = breathCompare(without, withBreath, "expected", prices)!;
  assert.equal(c.without.total, 15_000);
  assert.equal(c.with.total, 13_500);
  assert.equal(c.breathPrice, null);
  assert.equal(c.verdict, null);
  assert.equal(c.breathValue, 75);
  assert.deepEqual(c.unpriced, ["재봉술 : 업화 [19-20]", "용암의 숨결"]);
  // Prices not loaded yet: nothing to compare.
  assert.equal(breathCompare(without, withBreath, "expected", null), null);
});
