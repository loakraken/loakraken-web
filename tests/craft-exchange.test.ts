import { test } from "node:test";
import assert from "node:assert/strict";
import { CRAFT_DATA, craftResult } from "../lib/tools/abidos-craft";
import { LIFE_DATA, cheapestUnits } from "../lib/tools/life-exchange";

// Current-lowest prices read with comparison basis C's craft ranking
// (2026-10-14 14:43 KST): life materials in bundles of 100, fusion one by one.
const LOWEST: Record<string, [number, number]> = {
  "들꽃": [100, 311], "수줍은 들꽃": [100, 720], "화사한 들꽃": [100, 1099], "아비도스 들꽃": [100, 4199],
  "목재": [100, 284], "부드러운 목재": [100, 572], "튼튼한 목재": [100, 2857], "아비도스 목재": [100, 3718],
  "철광석": [100, 320], "묵직한 철광석": [100, 645], "단단한 철광석": [100, 3370], "아비도스 철광석": [100, 3999],
  "두툼한 생고기": [100, 413], "다듬은 생고기": [100, 828], "진귀한 가죽": [100, 19], "아비도스 두툼한 생고기": [100, 5540],
  "생선": [100, 410], "붉은 살 생선": [100, 821], "아비도스 태양 잉어": [100, 5899],
  "고대 유물": [100, 280], "희귀한 유물": [100, 780], "진귀한 유물": [100, 19], "아비도스 유물": [100, 3699],
  "아비도스 융화 재료": [1, 221], "상급 아비도스 융화 재료": [1, 269],
};
const unit = (name: string) => (LOWEST[name] ? LOWEST[name][1] / LOWEST[name][0] : null);
const label = (skillId: string, outputId: string) =>
  `${CRAFT_DATA.skills.find((s) => s.id === skillId)!.name}·${outputId === "abidos" ? "일반" : "상급"}`;
// Basis C's ranking: fee cut 17%, no great-success bonus, one craft, sold.
const ranking = (exchange: boolean) =>
  CRAFT_DATA.outputs
    .flatMap((o) => CRAFT_DATA.skills.map((s) => craftResult(o.id, s.id, unit, 0, 17, undefined, exchange)))
    .toSorted((a, b) => b.sellProfit! - a.sellProfit!)
    .map((r) => [label(r.skill.id, r.output.id), Math.round(r.sellProfit!), r.materials.some((m) => m.via)]);

test("exchange off: every skill and output matches basis C's one-craft profit", () => {
  assert.deepEqual(ranking(false), [
    ["벌목·일반", 134, false],
    ["고고학·일반", 50, false],
    ["벌목·상급", -9, false],
    ["채광·일반", -23, false],
    ["식물채집·일반", -115, false],
    ["고고학·상급", -119, false],
    ["채광·상급", -213, false],
    ["식물채집·상급", -333, false],
    ["수렵·일반", -693, false],
    ["낚시·일반", -806, false],
    ["수렵·상급", -1088, false],
    ["낚시·상급", -1235, false],
  ]);
});

test("exchange on: every skill and output matches basis C, with the 교환 mark where it applies", () => {
  assert.deepEqual(ranking(true), [
    ["벌목·일반", 189, true],
    ["고고학·일반", 152, true],
    ["벌목·상급", 63, true],
    ["고고학·상급", 14, true],
    ["식물채집·일반", -12, true],
    ["채광·일반", -23, false],
    ["식물채집·상급", -199, true],
    ["채광·상급", -213, false],
    ["낚시·일반", -551, true],
    ["수렵·일반", -569, true],
    ["낚시·상급", -902, true],
    ["수렵·상급", -925, true],
  ]);
});

test("the cheaper chain replaces the market price: 목재 → 벌목의 가루 → 아비도스 목재", () => {
  const r = craftResult("abidos", "logging", unit, 0, 17, undefined, true);
  const abidos = r.materials[0];
  assert.deepEqual(abidos.via, ["목재", "벌목의 가루", "아비도스 목재"]);
  // 2.84 × 100/80 × 100/10 = 35.5 a piece (market 37.18).
  assert.ok(Math.abs(abidos.unit! - 35.5) < 1e-9);
  // C: 1회 원가 2,005 = 1,171.5 + 257.4 + 244.24 + 332.
  assert.ok(Math.abs(r.cost! - 2005.14) < 1e-6);
});

test("a chain must be at least 0.5% cheaper, powder is never bought, a missing price stays missing", () => {
  const logging = LIFE_DATA.activities.find((a) => a.id === "logging")!;
  const units = cheapestUnits(logging, (role) => ({ abidos: 35.6, uncommon: 5.72, common: 2.84, rare: 28.57, powder: Infinity })[role], true);
  // 35.5 is only 0.28% under 35.6: the market price stays.
  assert.deepEqual(units.abidos, { unit: 35.6, path: ["abidos"] });
  const none = cheapestUnits(logging, () => Infinity, true);
  assert.equal(none.abidos.unit, Infinity);
  const off = craftResult("abidos", "logging", (n) => (n === "아비도스 목재" ? null : unit(n)), 0, 17, undefined, false);
  assert.equal(off.cost, null);
  assert.deepEqual(off.missing, ["아비도스 목재"]);
  // With the exchange the missing material is made from 목재, so the cost is known.
  const on = craftResult("abidos", "logging", (n) => (n === "아비도스 목재" ? null : unit(n)), 0, 17, undefined, true);
  assert.ok(on.cost != null);
  assert.deepEqual(on.missing, []);
});
