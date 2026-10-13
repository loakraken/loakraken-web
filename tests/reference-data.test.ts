import assert from "node:assert/strict";
import test from "node:test";
import { BRACELET_T4, checkBraceletData, type BraceletData } from "../lib/tools/bracelet-t4";
import { CRAFT_RECIPES, checkCraftData, type CraftData } from "../lib/tools/craft-recipes";
import { REST_GAUGE } from "../lib/tools/rest-gauge";

test("T4 bracelet data is the official table, consistent", () => {
  assert.deepEqual(checkBraceletData(BRACELET_T4), []);
  // 힘/민/지 유물 6400~12800, 고대 9600~16000 (공식 2025-12-30).
  assert.deepEqual(BRACELET_T4.mainStat[0].relic, [6400, 7040]);
  assert.deepEqual(BRACELET_T4.mainStat.at(-1)!.ancient, [15361, 16000]);
  assert.deepEqual(BRACELET_T4.combatStat.at(-1)!.relic, [95, 100]);
  assert.equal(BRACELET_T4.special.relic.length, 99);
  assert.equal(BRACELET_T4.special.ancient.length, 99);
  const broken = structuredClone(BRACELET_T4) as BraceletData;
  broken.mainStat[1].relic[0] += 1;
  broken.vitality[0].percent = 11;
  const problems = checkBraceletData(broken);
  assert.ok(problems.some((p) => p.includes("not contiguous")));
  assert.ok(problems.some((p) => p.includes("vitality: odds sum")));
});

test("craft recipes keep their source and never guess what one craft makes", () => {
  assert.deepEqual(checkCraftData(CRAFT_RECIPES), []);
  const count = Object.values(CRAFT_RECIPES.categories).reduce((sum, list) => sum + list.length, 0);
  assert.equal(count, 348);
  assert.ok(Object.values(CRAFT_RECIPES.categories).flat().every((r) => r.outputQty === null));
  const broken = structuredClone(CRAFT_RECIPES) as CraftData;
  Object.values(broken.categories)[0][0].materials[0].qty = 0;
  assert.ok(checkCraftData(broken).some((p) => p.includes("bad qty")));
});

test("rest gauge keeps only the stated rules; the unpublished numbers stay null", () => {
  assert.equal(REST_GAUGE.resonance.costPerEntry, 100);
  assert.equal(REST_GAUGE.restBonus.minToUse, 40);
  assert.equal(REST_GAUGE.resonance.max, null);
  assert.equal(REST_GAUGE.restBonus.rechargeRatio, null);
  for (const source of Object.values(REST_GAUGE.sources))
    assert.ok(source.url.startsWith("https://lostark.game.onstove.com/"));
});
