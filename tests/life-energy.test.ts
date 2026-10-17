import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIFE_DATA,
  activityResult,
  checkLifeData,
  dailyEnergy,
  gathered,
  lifeMarketNames,
  planCrafts,
  rankActivities,
  sellUnit,
  type Quote,
} from "../lib/tools/life-energy";

// Recent-trade prices read alongside comparison basis C's screen (2026-10-14
// 14:04 KST): life materials trade in bundles of 100, fusion materials one by one.
const RECENT: Record<string, number> = {
  "들꽃": 318, "수줍은 들꽃": 708, "화사한 들꽃": 1173, "아비도스 들꽃": 4399,
  "목재": 286, "부드러운 목재": 580, "튼튼한 목재": 2866, "아비도스 목재": 3722,
  "철광석": 318, "묵직한 철광석": 646, "단단한 철광석": 3370, "아비도스 철광석": 4000,
  "두툼한 생고기": 420, "다듬은 생고기": 840, "진귀한 가죽": 20, "아비도스 두툼한 생고기": 5540,
  "생선": 410, "붉은 살 생선": 810, "아비도스 태양 잉어": 5930,
  "고대 유물": 290, "희귀한 유물": 785, "진귀한 유물": 15, "아비도스 유물": 3749,
};
const FUSION: Record<string, number> = { "아비도스 융화 재료": 221, "상급 아비도스 융화 재료": 270 };
const quote = (name: string): Quote | null =>
  FUSION[name] != null
    ? { bundlePrice: FUSION[name], bundleCount: 1 }
    : RECENT[name] != null
      ? { bundlePrice: RECENT[name], bundleCount: 100 }
      : null;
// Basis C's defaults: fee cut 17% (full setup), no great-success bonus, exchange on, sell.
const C_SETTINGS = { feeCut: 17, increase: 0, exchange: true, purpose: "sell" as const };
const summary = (energy: number) =>
  rankActivities(energy, quote, C_SETTINGS).map((r) => [r.activity.name, r.best!.kind, r.best!.crafts, Math.round(r.best!.value)]);

test("the data is consistent with the craft recipes", () => {
  assert.deepEqual(checkLifeData(LIFE_DATA), []);
  assert.equal(LIFE_DATA.activities.length, 6);
  assert.equal(lifeMarketNames().length, 25);
});

test("daily recovery is 30 (33 blessed) every 10 minutes", () => {
  assert.equal(dailyEnergy(false), 4320);
  assert.equal(dailyEnergy(true), 4752);
});

test("gathered materials round down per grade", () => {
  const fishing = LIFE_DATA.activities.find((a) => a.id === "fishing")!;
  assert.deepEqual(gathered(fishing, 100), { abidos: 3, uncommon: 11, common: 19, rare: 0 });
  // Sale value per item: the 5% fee is rounded up on the bundle price.
  assert.equal(sellUnit({ bundlePrice: 410, bundleCount: 100 }), 3.89);
  assert.equal(sellUnit({ bundlePrice: 221, bundleCount: 1 }), 209);
});

test("matches basis C at 100 energy: every activity sells raw", () => {
  // Fishing: 19 × 3.89 + 11 × 7.69 + 3 × 56.33 = 327.49.
  assert.deepEqual(summary(100), [
    ["낚시", "raw", 0, 327],
    ["수렵", "raw", 0, 313],
    ["채광", "raw", 0, 309],
    ["벌목", "raw", 0, 297],
    ["고고학", "raw", 0, 268],
    ["식물채집", "raw", 0, 268],
  ]);
});

test("matches basis C at 1,000 energy: one craft wins for logging and archaeology", () => {
  assert.deepEqual(summary(1000), [
    ["낚시", "raw", 0, 3430],
    ["수렵", "raw", 0, 3416],
    ["채광", "raw", 0, 3323],
    ["벌목", "abidos", 1, 3263],
    ["식물채집", "raw", 0, 3148],
    ["고고학", "abidos", 1, 3141],
  ]);
});

test("matches basis C at 4,320 and 10,000 energy (crafts 7 and 18 for logging)", () => {
  assert.deepEqual(
    summary(4320).map(([name, kind, crafts, value]) => [name, kind, crafts, Math.round((value as number) / 1000) / 10]),
    [
      ["벌목", "abidos", 7, 1.6],
      ["낚시", "raw", 0, 1.5],
      ["수렵", "raw", 0, 1.5],
      ["채광", "abidos", 7, 1.5],
      ["고고학", "abidos", 7, 1.4],
      ["식물채집", "raw", 0, 1.4],
    ],
  );
  const top = rankActivities(10000, quote, C_SETTINGS);
  assert.deepEqual(
    top.map((r) => [r.activity.name, r.best!.kind, r.best!.crafts, Math.round(r.best!.value / 1000) / 10]),
    [
      ["벌목", "abidos", 18, 3.7],
      ["낚시", "raw", 0, 3.5],
      ["채광", "abidos", 17, 3.4],
      ["수렵", "raw", 0, 3.4],
      ["고고학", "abidos", 16, 3.2],
      ["식물채집", "raw", 0, 3.2],
    ],
  );
  // Per day: best ÷ energy × 4,320 → 1.6만 at 10,000.
  assert.equal(Math.round(((top[0].best!.value / 10000) * dailyEnergy(false)) / 1000) / 10, 1.6);
});

test("crafting only spends what was gathered: one more craft is not possible", () => {
  const logging = LIFE_DATA.activities.find((a) => a.id === "logging")!;
  const got = gathered(logging, 10000);
  const value = (role: string) =>
    role === "powder" ? 0 : sellUnit(quote(logging.items[role as "abidos"]!)!);
  const plan = (n: number) => planCrafts(logging, "abidos", n, got, value, 209, C_SETTINGS);
  assert.equal(plan(18).feasible, true);
  assert.equal(plan(19).feasible, false);
  // The exchange is what makes it possible: without it, 아비도스 목재 300 allows 9.
  const noExchange = (n: number) => planCrafts(logging, "abidos", n, got, value, 209, { ...C_SETTINGS, exchange: false });
  assert.equal(noExchange(9).feasible, true);
  assert.equal(noExchange(10).feasible, false);
});

test("a missing price is never 0: the activity has no result and names it", () => {
  const r = activityResult(LIFE_DATA.activities[0], 10000, (n) => (n === "들꽃" ? null : quote(n)), C_SETTINGS);
  assert.equal(r.best, null);
  assert.deepEqual(r.missing, ["들꽃"]);
  const noFusion = activityResult(LIFE_DATA.activities[1], 10000, (n) => (n.includes("융화") ? null : quote(n)), C_SETTINGS);
  assert.equal(noFusion.best?.kind, "raw");
  assert.equal(noFusion.crafted.abidos, null);
  assert.deepEqual(noFusion.missing, ["아비도스 융화 재료", "상급 아비도스 융화 재료"]);
});
