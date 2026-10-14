import assert from "node:assert/strict";
import test from "node:test";
import { SHOP_DATA, checkShopData, lineGold, onSale, packageValue, parseRate, purchasePlan, type ShopData } from "../lib/tools/loa-shop";
import { goldText, signedGold } from "../lib/tools/format";

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
  const kst = (iso: string) => Date.parse(`${iso}+09:00`);
  assert.equal(onSale(pkg("hangawi-battle"), kst("2026-10-13T12:00:00")), true);
  // "10월 21일(수) 정기 점검 전": still on sale at 05:59, over when maintenance starts at 06:00 (PM-프론트 #744 P3).
  assert.equal(onSale(pkg("hangawi-battle"), kst("2026-10-21T00:30:00")), true);
  assert.equal(onSale(pkg("hangawi-battle"), kst("2026-10-21T05:59:59")), true);
  assert.equal(onSale(pkg("hangawi-battle"), kst("2026-10-21T06:00:00")), false);
  assert.equal(onSale(pkg("monthly-growth-plus"), kst("2027-01-01T00:00:00")), true);
});

test("each content line rounds up to whole gold, as on the comparison basis (calc verification 2026-10-14)", () => {
  assert.equal(lineGold(274.3), 275);
  assert.equal(lineGold(274.0001), 275);
  assert.equal(lineGold(0.01), 1);
  // Within float error of a whole number: that number, not one more.
  assert.equal(1.1 * 100 === 110, false);
  assert.equal(lineGold(1.1 * 100), 110);
  assert.equal(lineGold(60000 * 8.8), 528000);
  assert.equal(lineGold(3 * 0.1), 1);
  assert.equal(lineGold(Infinity), null);
  assert.equal(lineGold(NaN), null);
  // Per line, not on the sum: two lines of 0.4 make 2, not 1.
  const p = structuredClone(SHOP_DATA.packages[0]);
  p.bonus = null;
  p.items = [
    { kind: "market", name: "가", qty: 1, detail: null },
    { kind: "market", name: "나", qty: 1, detail: null },
  ];
  const value = packageValue(p, () => 0.4, 27300);
  assert.deepEqual(value.items.map((i) => i.gold), [1, 1]);
  assert.equal(value.gold, 2);
  // A price of 0 is unknown, never counted as 0.
  const zero = packageValue(p, (n) => (n === "가" ? 0 : 0.4), 27300);
  assert.deepEqual(zero.unknown.map((i) => i.name), ["가"]);
  assert.equal(zero.gain, null);
});

test("로아샵 figures round the absolute value away from zero (its comparison basis)", () => {
  assert.equal(signedGold(-1087.5, "awayFromZero"), "−1,088");
  assert.equal(signedGold(1087.5, "awayFromZero"), "+1,088");
  assert.equal(signedGold(-1087.49, "awayFromZero"), "−1,087");
  assert.equal(goldText(-1087.5, "awayFromZero"), "-1,088");
  // The sign follows the value; only a value within 1e-9 of 0 has none.
  assert.equal(signedGold(-0.3, "awayFromZero"), "−0");
  assert.equal(signedGold(0, "awayFromZero"), "0");
  assert.equal(signedGold(1e-12, "awayFromZero"), "0");
  // The other tools keep .5 up.
  assert.equal(signedGold(-1087.5), "−1,087");
});
