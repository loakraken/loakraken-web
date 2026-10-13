import assert from "node:assert/strict";
import test from "node:test";
import { CRAFT_RECIPES as RECIPES } from "../lib/tools/craft-recipes";
import {
  CRAFT_DATA,
  checkCraftData,
  craftGoldAfterCut,
  craftMarketNames,
  craftResult,
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

test("the average yield is 105 at the base chance and 110 at +100% (the screens it was solved from)", () => {
  assert.equal(greatSuccessChance(0), 0.05);
  assert.ok(Math.abs(greatSuccessChance(7) - 0.0535) < 1e-12);
  assert.ok(Math.abs(expectedYield(0) - 105) < 1e-9);
  assert.ok(Math.abs(expectedYield(100) - 110) < 1e-9);
  // 4 crafts at +7% → 421.4 items (the other calculator's sale amount, read back).
  assert.equal(Math.round(expectedYield(7) * 4 * 10) / 10, 421.4);
});

test("cost, value and profit of one craft, with the fee cut and the market fee", () => {
  const prices: Record<string, number> = { "아비도스 목재": 10, "부드러운 목재": 4, "목재": 1, "아비도스 융화 재료": 90 };
  const r = craftResult("abidos", "logging", (n) => prices[n] ?? null, 0, 17);
  // 33×10 + 45×4 + 86×1 = 596, craft gold 400 × 0.83 = 332.
  assert.ok(Math.abs(r.craftGold - 332) < 1e-9);
  assert.ok(Math.abs(r.cost! - (596 + 332)) < 1e-9);
  assert.ok(Math.abs(r.use! - 105 * 90) < 1e-6);
  // Sold in bundles of 10: 900 − ⌈45⌉ = 855 per bundle × 10.5 bundles.
  assert.ok(Math.abs(r.sell! - 855 * 10.5) < 1e-6);
  assert.ok(Math.abs(r.useProfit! - (105 * 90 - 928)) < 1e-6);
  assert.deepEqual(r.missing, []);
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
