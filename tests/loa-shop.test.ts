import assert from "node:assert/strict";
import test from "node:test";
import { SHOP_DATA, checkShopData, onSale, packageValue, parseRate, purchasePlan, type ShopData } from "../lib/tools/loa-shop";

const pkg = (id: string) => SHOP_DATA.packages.find((p) => p.id === id)!;

test("shop data comes from official notices and is consistent", () => {
  assert.deepEqual(checkShopData(SHOP_DATA), []);
  // 크리스탈 [200개] = 5,500 로열 크리스탈 → 100개 = 2,750.
  assert.equal(SHOP_DATA.crystal.royalPer100, 2750);
  const broken = structuredClone(SHOP_DATA) as ShopData;
  broken.packages[0].source = "nowhere";
  broken.packages[1].items[0].qty = 0;
  const problems = checkShopData(broken);
  assert.ok(problems.some((p) => p.includes("unknown source")));
  assert.ok(problems.some((p) => p.includes("bad qty")));
});

test("the 3+1 package reproduces the calc verification sample (L45, 2026-10-12)", () => {
  // Fixture prices: 파괴석 결정 8.8, 수호석 결정 1.97, 상급 아비도스 271, 용암 508, 빙하 455; 100 크리스탈 = 27,300G.
  const prices: Record<string, number> = {
    "운명의 파괴석 결정": 8.8,
    "운명의 수호석 결정": 1.97,
    "상급 아비도스 융화 재료": 271,
    "용암의 숨결": 508,
    "빙하의 숨결": 455,
  };
  const value = packageValue(pkg("monthly-growth-plus"), (n) => prices[n] ?? null, 27300);
  assert.deepEqual(purchasePlan(pkg("monthly-growth-plus")), { purchases: 3, sets: 4, priceRoyal: 99000 });
  assert.deepEqual(
    value.items.map((i) => i.total),
    [60000, 180000, 2000, 560, 560],
  );
  assert.equal(Math.round(value.gold), 1963880);
  assert.equal(Math.round(value.gain!), 98827);
});

test("no exchange rate or an unpriced content: shown side by side, never a gain", () => {
  const prices = (n: string) => (n === "용암의 숨결" ? null : 100);
  const noRate = packageValue(pkg("monthly-growth-plus"), () => 1, null);
  assert.equal(noRate.gain, null);
  assert.ok(noRate.gold > 0);
  const missing = packageValue(pkg("monthly-growth-plus"), prices, 27300);
  assert.deepEqual(
    missing.unknown.map((i) => i.name),
    ["용암의 숨결"],
  );
  assert.equal(missing.gain, null, "an unknown content is not counted as 0");
});

test("crystal packages: crystals the same price buys at the shop, valued only with the rate", () => {
  const value = packageValue(pkg("item-level-1700"), () => null, null);
  assert.equal(value.crystals, 2600);
  // 55,000 로열 크리스탈 = 크리스탈 2,000개(공식 상점 비율).
  assert.equal(value.crystalsForPrice, 2000);
  assert.equal(value.gain, null);
  const rated = packageValue(pkg("item-level-1700"), () => null, 27300);
  assert.equal(Math.round(rated.gain!), 71500 - 55000);
});

test("the exchange rate field takes a positive whole number only", () => {
  assert.equal(parseRate(""), null);
  assert.equal(parseRate("0"), null);
  assert.equal(parseRate("27,300"), 27300);
  assert.equal(parseRate("abc"), null);
});

test("a package past its last day is no longer on sale", () => {
  assert.equal(onSale(pkg("hangawi-battle"), "2026-10-13"), true);
  assert.equal(onSale(pkg("hangawi-battle"), "2026-10-21"), false);
  assert.equal(onSale(pkg("monthly-growth-plus"), "2027-01-01"), true);
});
