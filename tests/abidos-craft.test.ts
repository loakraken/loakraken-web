import assert from "node:assert/strict";
import test from "node:test";
import { CRAFT_RECIPES as RECIPES } from "../lib/tools/craft-recipes";
import {
  CRAFT_DATA,
  checkCraftData,
  craftGoldAfterCut,
  craftMarketNames,
  craftResult,
  energyAfterCut,
  expectedYield,
  greatSuccessChance,
  parsePercent,
  sellValue,
} from "../lib/tools/abidos-craft";

test("craft data is consistent and matches the crafting database rows", () => {
  assert.deepEqual(checkCraftData(CRAFT_DATA), []);
  // Every skill/output pair is the same row as the recipe data (E41, #740).
  const special = RECIPES.categories["특수"];
  for (const skill of CRAFT_DATA.skills)
    for (const output of CRAFT_DATA.outputs) {
      const want = CRAFT_DATA.skills.find((s) => s.id === skill.id)!.materials[output.id];
      const row = special.find(
        (r) => r.name === output.name && r.materials.map((m) => m.name).join() === want.map(([n]) => n).join(),
      );
      assert.ok(row, `${skill.name} ${output.name}`);
      assert.deepEqual(row!.materials.map((m) => m.qty), want.map(([, q]) => q));
      assert.equal(row!.gold, output.gold);
      assert.equal(row!.energy, output.energy);
    }
  assert.equal(craftMarketNames().length, 2 + 6 * 3);
});

test("the average yield is 10.5 at the base chance and 11 at +100% (one craft; the screen's 105·110 are 10 crafts)", () => {
  assert.equal(greatSuccessChance(0), 0.05);
  assert.ok(Math.abs(greatSuccessChance(7) - 0.0535) < 1e-12);
  assert.ok(Math.abs(expectedYield(0) - 10.5) < 1e-9);
  assert.ok(Math.abs(expectedYield(100) - 11) < 1e-9);
  // 10 crafts = the screen's 평균 개수 105 (the site script's output is 10 a craft).
  assert.ok(Math.abs(expectedYield(0) * 10 - 105) < 1e-9);
  // 4 crafts at +7% → 42.14 items.
  assert.equal(Math.round(expectedYield(7) * 4 * 100) / 100, 42.14);
});

test("cost, value and profit of one craft, with the fee cut and the market fee", () => {
  const prices: Record<string, number> = { "아비도스 목재": 10, "부드러운 목재": 4, "목재": 1, "아비도스 융화 재료": 90 };
  const r = craftResult("abidos", "logging", (n) => prices[n] ?? null, 0, 17);
  // 33×10 + 45×4 + 86×1 = 596, craft gold 400 × 0.83 = 332.
  assert.ok(Math.abs(r.craftGold - 332) < 1e-9);
  assert.ok(Math.abs(r.cost! - (596 + 332)) < 1e-9);
  assert.ok(Math.abs(r.use! - 10.5 * 90) < 1e-6);
  // Sold in bundles of 10: 900 − ⌈45⌉ = 855 per bundle × 1.05 bundles.
  assert.ok(Math.abs(r.sell! - 855 * 1.05) < 1e-6);
  assert.ok(Math.abs(r.useProfit! - (10.5 * 90 - 928)) < 1e-6);
  assert.deepEqual(r.missing, []);
  // Per 100 base energy (288 for 아비도스).
  assert.ok(Math.abs(r.usePer100Energy! - ((10.5 * 90 - 928) * 100) / 288) < 1e-6);
  assert.ok(Math.abs(r.sellPer100Energy! - ((855 * 1.05 - 928) * 100) / 288) < 1e-6);
});

test("a missing price is never 0: no cost, no profit, and it is named", () => {
  const r = craftResult("superior", "mining", (n) => (n === "철광석" ? null : 5), 0, 0);
  assert.equal(r.cost, null);
  assert.equal(r.sellProfit, null);
  assert.deepEqual(r.missing, ["철광석"]);
});

test("percent fields take 0~100 with one decimal at most", () => {
  assert.equal(parsePercent(""), null);
  assert.equal(parsePercent("0"), 0);
  assert.equal(parsePercent("17"), 17);
  assert.equal(parsePercent("7.5"), 7.5);
  assert.equal(parsePercent("101"), null);
  assert.equal(parsePercent("-1"), null);
  assert.equal(parsePercent("1.25"), null);
});

test("rounding follows the comparison calculator (calc verification 2026-10-13 19:50)", () => {
  // Craft gold after the cut rounds up, computed without floating-point drift.
  assert.equal(craftGoldAfterCut(400, 17), 332);
  assert.equal(craftGoldAfterCut(520, 17), 432);
  assert.equal(craftGoldAfterCut(520, 13), 453);
  assert.equal(craftGoldAfterCut(520, 0), 520);
  // The market fee is rounded up per 10-item bundle: 269 → 255, 215 → 204.
  assert.equal(sellValue(26.9, 10), 255);
  assert.equal(sellValue(21.5, 10), 204);
  assert.ok(Math.abs(sellValue(26.9, 105) - 255 * 10.5) < 1e-9);
});

test("energy-cost reduction: the cuts add up and the energy rounds down (calc verification 23:16)", () => {
  assert.equal(energyAfterCut(288, 13, 0), 250);
  assert.equal(energyAfterCut(360, 17, 0), 298);
  // overall 10 + 특수 10 = 20% → 230 (multiplying the two would give 233).
  assert.equal(energyAfterCut(288, 10, 10), 230);
  assert.equal(energyAfterCut(288, 0, 0), 288);
  assert.equal(energyAfterCut(288, 60, 60), 0);
  const prices: Record<string, number> = { "아비도스 목재": 10, "부드러운 목재": 4, "목재": 1, "아비도스 융화 재료": 90 };
  const r = craftResult("abidos", "logging", (n) => prices[n] ?? null, 0, 0, { overall: 10, category: 10 });
  assert.equal(r.energy, 230);
  assert.ok(Math.abs(r.usePer100Energy! - ((10.5 * 90 - 996) * 100) / 230) < 1e-6);
  const none = craftResult("abidos", "logging", (n) => prices[n] ?? null, 0, 0, { overall: 60, category: 60 });
  assert.equal(none.usePer100Energy, null, "no energy left: no per-energy figure");
});
