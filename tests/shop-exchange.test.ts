import assert from "node:assert/strict";
import test from "node:test";
import {
  SHOP_DATA,
  cartMax,
  cartSummary,
  checkShopData,
  parseUserGold,
  rankShop,
  rowName,
  rowDate,
  rowValue,
  shopMarketNames,
  type ShopRow,
} from "../lib/tools/shop-exchange";

const shop = (id: string) => SHOP_DATA.shops.find((s) => s.id === id)!;
const row = (id: string) => SHOP_DATA.shops.flatMap((s) => s.rows).find((r) => r.id === id)!;
const prices: Record<string, number> = { "카르마의 잔영": 260, "운명의 파괴석 결정": 9, "운명의 수호석 결정": 1.9, "운명의 파괴석": 0.8, "베히모스의 비늘": 50 };
const price = (name: string) => prices[name] ?? null;

test("shop data: consistent, 71 rows (레이드 24 · 싱글 18 · 길드 29), every row dated", () => {
  assert.deepEqual(checkShopData(SHOP_DATA), []);
  assert.deepEqual(SHOP_DATA.shops.map((s) => [s.id, s.rows.length]), [["raid", 24], ["single", 18], ["guild", 29]]);
  for (const s of SHOP_DATA.shops) for (const r of s.rows) assert.match(rowDate(r), /^\d{4}-\d{2}-\d{2}$/);
  // The inferred pouch sizes and the cut guild rows are marked, nothing else.
  const checking = SHOP_DATA.shops.flatMap((s) => s.rows).filter((r) => r.checking).map((r) => r.id);
  assert.deepEqual(checking, [
    "single-07", "single-12", "single-13", "single-15", "single-16", "single-17", "single-18",
    "guild-22", "guild-23", "guild-24", "guild-25", "guild-26", "guild-27", "guild-28", "guild-29",
  ]);
});

test("the data check catches a missing market name and an unmarked inferred size", () => {
  const bad = structuredClone(SHOP_DATA);
  delete (bad.shops[1].rows[1] as Partial<ShopRow>).market;
  delete (bad.shops[1].rows[6] as Partial<ShopRow>).checking;
  assert.deepEqual(checkShopData(bad), [
    "single-02: a market name exactly on DIRECT rows",
    "single-07: an inferred size must be marked checking",
  ]);
});

test("market names: every DIRECT row's item and every currency", () => {
  const names = shopMarketNames();
  for (const name of ["카르마의 잔영", "운명의 파괴석 결정", "고통의 가시", "싱글 코인", "실마엘 혈석"]) assert.ok(names.includes(name), name);
});

test("row value: market price × units per 1 currency; boxes, choices, bound and unpriced items wait for a user value", () => {
  // 카르마의 잔영 ×30 for 240 싱글 코인 at 260 G each.
  assert.deepEqual(rowValue(row("single-02"), price, {}), { state: "OK", gold: 7800, perCurrency: 7800 / 240, from: "MARKET" });
  assert.deepEqual(rowValue(row("raid-03"), price, {}), { state: "NEEDS_VALUE", key: "사령의 재련 보조 재료 주머니", why: "BOX" });
  assert.deepEqual(rowValue(row("single-01"), price, {}), { state: "NEEDS_VALUE", key: "T4 재봉술 선택 상자 (귀속)", why: "CHOICE" });
  assert.deepEqual(rowValue(row("single-03"), price, {}), { state: "NEEDS_VALUE", key: "아비도스 융화 재료 (귀속)", why: "BOUND" });
  // No market price for the item: the user's value per unit of it.
  assert.deepEqual(rowValue(row("single-05"), price, {}), { state: "NEEDS_VALUE", key: "고통의 가시", why: "NO_PRICE" });
  assert.deepEqual(rowValue(row("single-05"), price, { "고통의 가시": 500 }), { state: "OK", gold: 10000, perCurrency: 25, from: "USER" });
  // A box value is per box (×qty).
  assert.deepEqual(rowValue(row("raid-03"), price, { "사령의 재련 보조 재료 주머니": 3000 }), { state: "OK", gold: 3000, perCurrency: 300, from: "USER" });
  // A row being checked never gets a value, even with a market price and a user value.
  assert.deepEqual(rowValue(row("single-07"), price, { "운명의 파괴석 결정": 1 }), { state: "CHECKING", reason: "주머니 1개의 수량(200개)을 확인 중" });
  // Zero or negative user values do not count.
  assert.equal(rowValue(row("raid-03"), price, { "사령의 재련 보조 재료 주머니": 0 }).state, "NEEDS_VALUE");
});

test("rank: valued rows best gold per currency first, then rows waiting for a value, then rows being checked", () => {
  const ranked = rankShop(shop("guild"), price, { "요즈의 입장권 상자": 2000 });
  const head = ranked.filter((r) => r.rank != null);
  // 파괴석 결정 40 × 9 = 360 for 690 / 770; 수호석 결정 40 × 1.9 = 76 for 240 / 270; 파괴석 40 × 0.8 = 32 for 690 / 770;
  // 요즈의 입장권 상자 2,000 for 3,240 / 3,600.
  assert.deepEqual(head.map((r) => [r.row.id, r.rank]), [
    ["guild-06", 1], ["guild-09", 2], ["guild-11", 3], ["guild-13", 4], ["guild-18", 5], ["guild-19", 6], ["guild-20", 7], ["guild-21", 8],
  ]);
  for (let i = 1; i < head.length; i++)
    assert.ok((head[i - 1].value as { perCurrency: number }).perCurrency >= (head[i].value as { perCurrency: number }).perCurrency);
  const tail = ranked.slice(head.length);
  assert.ok(tail.every((r) => r.rank === null));
  const firstChecking = tail.findIndex((r) => r.value.state === "CHECKING");
  assert.ok(tail.slice(0, firstChecking).every((r) => r.value.state === "NEEDS_VALUE"));
  assert.ok(tail.slice(firstChecking).every((r) => r.value.state === "CHECKING"));
  assert.equal(ranked.length, 29);
});

test("cart: spend per currency, gold of valued lines, unvalued lines counted, net over the currency's own price", () => {
  const cartPrice = (name: string) => (name === "베히모스의 비늘" ? 50 : price(name));
  const summary = cartSummary(
    { "single-02": 1, "single-10": 3, "guild-11": 2, "guild-03": 1, "single-07": 2, "raid-13": 2 },
    cartPrice,
    { "폭풍의 재련 보조 재료 주머니": 800 },
  );
  // single-10 has limit 1: clamped. single-07 is being checked: counted as unvalued. guild-03 waits for a value.
  assert.equal(summary.lines, 6);
  assert.equal(summary.unvalued, 2);
  const by = Object.fromEntries(summary.spend.map((s) => [s.currency, s]));
  assert.equal(by["싱글 코인"].cost, 240 + 140 + 70 * 2);
  assert.equal(by["실마엘 혈석"].cost, 690 * 2 + 3600);
  assert.equal(by["베히모스의 비늘"].cost, 15 * 2);
  // Gold: 카르마 7,800 + 비늘 40 × 50 = 2,000 (once) + 파괴석 결정 360 × 2 + 폭풍 주머니 800 × 2.
  assert.equal(summary.gold, 7800 + 2000 + 720 + 1600);
  // Net: only 베히모스의 비늘 has a market price among the currencies (30 × 50 = 1,500 given up).
  assert.equal(summary.currencyGold, 1500);
  assert.deepEqual(summary.unpricedCurrencies.sort(), ["실마엘 혈석", "싱글 코인"]);
  assert.equal(summary.net, summary.gold - 1500);
  // A currency with an unvalued line has no per-currency figure; one with all lines valued does.
  assert.equal(by["싱글 코인"].perCurrency, null);
  assert.equal(by["베히모스의 비늘"].perCurrency, 1600 / 30);
  assert.equal(cartMax(row("raid-01")), 99);
  assert.equal(cartMax(row("single-17")), 30);
});

test("parseUserGold: values over 0 with or without thousands commas; empty clears; anything else is invalid (codex P2 on #1928)", () => {
  assert.deepEqual(parseUserGold("2000"), { ok: true, value: 2000 });
  assert.deepEqual(parseUserGold(" 2,000 "), { ok: true, value: 2000 });
  assert.deepEqual(parseUserGold("1,234,567.5"), { ok: true, value: 1234567.5 });
  assert.deepEqual(parseUserGold("0.25"), { ok: true, value: 0.25 });
  assert.deepEqual(parseUserGold(""), { ok: true, value: null });
  assert.deepEqual(parseUserGold("   "), { ok: true, value: null });
  // The paste that was saved as 100, and the text that deleted the saved value.
  for (const bad of ["-100", "1..2", "1,0,0", "12abc", "0", "0.0", ".5", "1.", "1e3", "Infinity", "2,00"])
    assert.deepEqual(parseUserGold(bad), { ok: false }, bad);
});

test("rowName tells every row apart: the same item at two price steps differs by cost (codex P2 on #1928)", () => {
  const rows = SHOP_DATA.shops.flatMap((shop) => shop.rows);
  const names = rows.map(rowName);
  assert.equal(new Set(names).size, rows.length);
  const steps = rows.filter((row) => row.item === "운명의 파괴석 결정" && row.currency === "실마엘 혈석").map(rowName);
  assert.deepEqual(steps, ["운명의 파괴석 결정 690 실마엘 혈석", "운명의 파괴석 결정 770 실마엘 혈석"]);
});
