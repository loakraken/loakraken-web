// M41 (PM 총괄 11-22 13:40): per part, 숨결 없이 vs 숨결 최대 for the same target, each side valued at market
// (누골 + every material at its unit price, owned ones too), and one breath's value = (no-breath total − with-breath
// total with breath at 0G) ÷ expected breaths, against the breath's market price.
import assert from "node:assert/strict";
import test from "node:test";
import { breathCompare, leftOutLabel, priceNames } from "../lib/refining/breath";
import type { PartPlan, Plan } from "../lib/refining/model";
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

test("no breath price: the 숨결 최대 total is short by the breaths, so no 'cheaper' and no verdict (the value still shown)", () => {
  // PM-프론트 #1932 P2: 13,500 (breath left out) looked cheaper than 15,000 while the verdict could not judge.
  const without = plan(10_000, [["운명의 파편", 50_000]]);
  const withBreath = plan(9_000, [["운명의 파편", 45_000], ["용암의 숨결", 20]]);
  const c = breathCompare(without, withBreath, "expected", prices)!;
  assert.equal(c.without.total, 15_000);
  assert.equal(c.with.total, 13_500);
  assert.equal(c.without.incomplete, false);
  assert.equal(c.with.incomplete, true);
  assert.equal(c.cheaper, null);
  assert.equal(c.breathPrice, null);
  assert.equal(c.verdict, null);
  assert.equal(c.breathValue, 75);
  assert.deepEqual(c.unpriced, ["용암의 숨결"]);
  // Prices not loaded yet: nothing to compare.
  assert.equal(breathCompare(without, withBreath, "expected", null), null);
});

test("an unpriced material used in different amounts: both totals incomplete, no 'cheaper', no breath value, named", () => {
  // PM-프론트 #1932 ruling: 10 books vs 8 books, unpriced — leaving them out biases both totals and the saving.
  const without = plan(10_000, [["운명의 파편", 50_000], ["재봉술 : 업화 [19-20]", 10]]);
  const withBreath = plan(9_000, [["운명의 파편", 45_000], ["빙하의 숨결", 20], ["재봉술 : 업화 [19-20]", 8]]);
  const c = breathCompare(without, withBreath, "expected", prices)!;
  assert.equal(c.without.incomplete, true);
  assert.equal(c.with.incomplete, true);
  assert.equal(c.cheaper, null);
  assert.equal(c.breathValue, null);
  assert.equal(c.verdict, null);
  assert.deepEqual(c.uneven, ["재봉술 : 업화 [19-20]"]);
  assert.deepEqual(c.unpriced, ["재봉술 : 업화 [19-20]"]);
});

test("an unpriced material used in the same amount on both sides cancels out: the verdict stands", () => {
  const without = plan(10_000, [["운명의 파편", 50_000], ["실링", 1_000]]);
  const withBreath = plan(9_000, [["운명의 파편", 45_000], ["빙하의 숨결", 20], ["실링", 1_000]]);
  const c = breathCompare(without, withBreath, "expected", prices)!;
  // Each total still leaves the 실링 out, so each reads '이상' (PM-프론트 #1932 follow-up P3) — but the gap is the same,
  // so which way costs less and the verdict stand.
  assert.equal(c.without.incomplete, true);
  assert.equal(c.with.incomplete, true);
  assert.deepEqual(c.uneven, []);
  assert.deepEqual(c.unpriced, ["실링"]);
  assert.equal(c.cheaper, "without"); // 15,000 vs 13,500 + 8,000
  assert.equal(c.breathValue, 75);
  assert.equal(c.verdict, "SKIP");
});

test("the left-out line: two names then how many more on screen, every name in the read text", () => {
  assert.deepEqual(leftOutLabel([]), { visible: "", full: "" });
  assert.deepEqual(leftOutLabel(["실링"]), { visible: "시세가 없어 뺀 재료: 실링", full: "시세가 없어 뺀 재료: 실링" });
  const names = ["재봉술 : 업화 [15-18]", "재봉술 : 업화 [19-20]", "용암의 숨결", "실링", "골드"];
  const label = leftOutLabel(names);
  assert.equal(label.visible, "시세가 없어 뺀 재료: 재봉술 : 업화 [15-18], 재봉술 : 업화 [19-20] 외 3개");
  // PM-프론트 #1943: '외 N개' must not take the names away from screen readers (a breath only 숨결 최대 uses is
  // nowhere else on the page).
  assert.equal(label.full, `시세가 없어 뺀 재료: ${names.join(", ")}`);
  for (const name of names) assert.ok(label.full.includes(name), name);
});

// PM-프론트 #1932 (performance first): one price request a minute for the result and the compare together.
test("priceNames: the page's own materials in plan order, then each part's breaths; the breaths left off past the limit", () => {
  const weapon = { part: { id: "weapon", type: "WEAPON" }, plan: plan(1, [["운명의 파괴석", 10], ["운명의 파편", 10]]) };
  const helmet = { part: { id: "helmet", type: "ARMOR" }, plan: plan(1, [["운명의 수호석", 10], ["운명의 파편", 10]]) };
  const guard = { part: { id: "armGuard", type: "ARM_GUARD" }, plan: plan(1, [["운명의 파편", 10]]) };
  const names = priceNames([weapon, helmet, guard] as unknown as PartPlan[], "expected");
  assert.deepEqual(names, ["운명의 파괴석", "운명의 파편", "운명의 수호석", "용암의 숨결", "빙하의 숨결"]);
  // A plan that already uses a breath (숨결 on): no duplicate.
  const withBreath = { part: { id: "weapon", type: "WEAPON" }, plan: plan(1, [["운명의 파괴석", 10], ["용암의 숨결", 20]]) };
  assert.deepEqual(priceNames([withBreath] as unknown as PartPlan[], "expected"), ["운명의 파괴석", "용암의 숨결"]);
  // Past MAX_PRICE_NAMES with the breaths: the page's own list only (its prices never go off for the compare).
  const many = { part: { id: "weapon", type: "WEAPON" }, plan: plan(1, Array.from({ length: 20 }, (_, i) => [`재료 ${i}`, 1] as [string, number])) };
  assert.equal(priceNames([many] as unknown as PartPlan[], "expected").length, 20);
});
// web #1985 (계산 검증 11-28, real api plan, P0 for v0.3.16): 전율 무기 20→21, 536.59 expected breaths, break-even
// breath price 1,155.1982G. Rounded first, 1,155.20–1,155.49G read BUY (1,155 vs 1,155) while the same row's totals
// said 'without' was cheaper (1,859,773.23 vs 1,859,929.80). Now both come from the unrounded gold and always agree.
test("the verdict and the cheaper side agree at the break-even price (unrounded, 계산 검증's numbers)", () => {
  const breaths = 536.59;
  const breakEven = 1155.1982;
  const withoutTotal = 1_859_773.23;
  // The 숨결 최대 side's gold so that one breath is worth exactly the break-even price.
  const withGold = withoutTotal - breaths * breakEven;
  const without = plan(withoutTotal, []);
  const withBreath = plan(withGold, [["용암의 숨결", breaths]]);
  const at = (unit: number) => breathCompare(without, withBreath, "expected", [price("용암의 숨결", unit)])!;

  // 1,155.20: the row the sweep flagged — SKIP, 'without' cheaper, though both figures read 1,155.
  const flagged = at(1155.2);
  assert.equal(flagged.breathValue, 1155);
  assert.equal(flagged.breathPrice, 1155);
  assert.equal(flagged.verdict, "SKIP");
  assert.equal(flagged.cheaper, "without");
  // Just below break-even: BUY, 숨결 최대 cheaper.
  const below = at(1155.19);
  assert.equal(below.verdict, "BUY");
  assert.equal(below.cheaper, "with");
  // The whole band around it, a cent apart: never a flip.
  for (let cents = 115_480; cents <= 115_560; cents += 1) {
    const c = at(cents / 100);
    const buy = c.verdict === "BUY";
    const withSide = c.cheaper === "with" || c.cheaper === "same";
    assert.equal(buy, withSide, `${cents / 100}G: verdict ${c.verdict}, cheaper ${c.cheaper}`);
  }
});

test("the 방어구 case flips the same way and is fixed the same way (빙하의 숨결)", () => {
  const breaths = 412.37;
  const breakEven = 731.4567;
  const withoutTotal = 912_345.67;
  const without = plan(withoutTotal, []);
  const withBreath = plan(withoutTotal - breaths * breakEven, [["빙하의 숨결", breaths]]);
  const at = (unit: number) => breathCompare(without, withBreath, "expected", [price("빙하의 숨결", unit)])!;
  // 731.46–731.49: rounded both read 731, the totals say 'without'.
  for (const unit of [731.46, 731.47, 731.49]) {
    const c = at(unit);
    assert.equal(c.verdict, "SKIP", String(unit));
    assert.equal(c.cheaper, "without", String(unit));
  }
  assert.equal(at(731.45).verdict, "BUY");
  assert.equal(at(731.45).cheaper, "with");
});