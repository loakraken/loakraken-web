import assert from "node:assert/strict";
import test from "node:test";
import { SHOP_DATA, UNTRADEABLE, checkShopData, lineGold, onSale, packageValue, parseRate, purchasePlan, splitBySale, type ShopData } from "../lib/tools/loa-shop";
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
  // The sign follows the value; a value that rounds to 0 has none (PM 총괄, unlike the basis' "−0").
  assert.equal(signedGold(-0.3, "awayFromZero"), "0");
  assert.equal(signedGold(-0.5, "awayFromZero"), "−1");
  assert.equal(signedGold(0, "awayFromZero"), "0");
  assert.equal(signedGold(1e-12, "awayFromZero"), "0");
  // The other tools keep .5 up.
  assert.equal(signedGold(-1087.5), "−1,087");
test("ended sales are split off from those on sale (folded on screen), by the KST end time in the data", () => {
  const kst = (iso: string) => Date.parse(`${iso}+09:00`);
  // Every end time is a KST timestamp; "정기 점검 전" is Wednesday 06:00.
  for (const p of SHOP_DATA.packages) if (p.endsAt) assert.match(p.endsAt, /T06:00:00\+09:00$/);
  const before = splitBySale(SHOP_DATA.packages, kst("2026-10-21T05:59:59"));
  assert.equal(before.past.length, 0);
  const after = splitBySale(SHOP_DATA.packages, kst("2026-10-21T06:00:00"));
  assert.deepEqual(after.past.map((p) => p.id), ["hangawi-battle", "hangawi-life", "hangawi-card", "hangawi-peon"]);
  assert.deepEqual(after.current.map((p) => p.id), ["monthly-growth-plus", "item-level-1700", "region-clear-kadarum"]);
  // A malformed end time is reported.
  const broken = structuredClone(SHOP_DATA) as ShopData;
  broken.packages[3].endsAt = "2026-10-21";
  assert.ok(checkShopData(broken).some((p) => p.includes("bad endsAt")));
});

test("untradeable contents are left out of the gold and the gain is still computed; a tradeable one without a price blocks it (PM 총괄 2026-10-14)", () => {
  const p = structuredClone(SHOP_DATA.packages[0]);
  p.bonus = null;
  p.priceRoyal = 1000;
  p.items = [
    { kind: "market", name: "가", qty: 10, detail: null },
    { kind: "market", name: "불가", qty: 5, detail: null },
  ];
  // Untradeable: out of the gold, listed, and the gain is computed from the rest.
  const out = packageValue(p, (n) => (n === "불가" ? UNTRADEABLE : 27.5), 27500);
  assert.deepEqual(out.untradeable.map((i) => i.name), ["불가"]);
  assert.deepEqual(out.unknown, []);
  assert.equal(out.gold, 275);
  assert.equal(out.items[1].gold, null);
  assert.equal(out.items[1].untradeable, true);
  // 275G × 2,750 ÷ 27,500 = 27.5 royal, gain 27.5 − 1,000.
  assert.equal(out.royalValue, 27.5);
  assert.equal(out.gain, 27.5 - 1000);
  // Tradeable but no price now: 미확인, and no gain.
  const missing = packageValue(p, (n) => (n === "불가" ? null : 27.5), 27500);
  assert.deepEqual(missing.unknown.map((i) => i.name), ["불가"]);
  assert.deepEqual(missing.untradeable, []);
  assert.equal(missing.gain, null);
  // Both at once: the unknown one still blocks the gain.
  p.items.push({ kind: "market", name: "없음", qty: 1, detail: null });
  const both = packageValue(p, (n) => (n === "불가" ? UNTRADEABLE : n === "없음" ? null : 27.5), 27500);
  assert.deepEqual([both.untradeable.length, both.unknown.length, both.gain], [1, 1, null]);
  // A package of untradeable contents only: 0 tradeable gold, the gain is −price.
  const life = packageValue(pkg("hangawi-life"), () => UNTRADEABLE, 27500);
  assert.equal(life.gold, 0);
  assert.equal(life.untradeable.length, 2);
  assert.equal(life.gain, -SHOP_DATA.packages.find((x) => x.id === "hangawi-life")!.priceRoyal);
});
