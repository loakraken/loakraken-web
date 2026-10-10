import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  boardQueryString,
  boardSearchParams,
  changeLabel,
  changeWithAmount,
  completedDays,
  goldText,
  unitPrice,
  updatedAgo,
  parseItemId,
  readBoardQuery,
} from "../lib/market/board";
import {
  isBoardEnvelope,
  isItemHistoryEnvelope,
  isTabsEnvelope,
} from "../lib/market/validate";
import { requestBoard, requestItemHistory } from "../lib/market/upstream";
import { parseFavorites, toggleFavorite } from "../lib/market/favorites";

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`./market-fixtures/${name}`, import.meta.url), "utf8"),
  );
const origin = "http://127.0.0.1:8080";

test("backend-generated board, tabs and history fixtures satisfy the contract", () => {
  assert.equal(isTabsEnvelope(fixture("market-tabs.json")), true);
  assert.equal(isBoardEnvelope(fixture("market-board.json")), true);
  assert.equal(isItemHistoryEnvelope(fixture("market-item-history.json")), true);
  const broken = fixture("market-board.json");
  broken.data.items[0].changeDay = "13%";
  assert.equal(isBoardEnvelope(broken), false);
});

test("board query is allow-listed and the page URL falls back to defaults", () => {
  assert.equal(
    boardSearchParams(new URLSearchParams("tab=LIFE&tier=4&sort=rise&page=2&x=1"))?.toString(),
    "tab=LIFE&tier=4&sort=rise&page=2",
  );
  for (const bad of ["", "tab=GEM", "tab=LIFE&tier=5", "tab=LIFE&sort=up", "tab=LIFE&page=11", "tab=LIFE&page=1.5"])
    assert.equal(boardSearchParams(new URLSearchParams(bad)), null, bad);
  assert.deepEqual(readBoardQuery({}), { tab: "REFINING", tier: null, sort: "default", page: 1 });
  assert.deepEqual(readBoardQuery({ tab: "FOOD", sort: "fall", page: "3", tier: "9" }), {
    tab: "FOOD",
    tier: null,
    sort: "fall",
    page: 3,
  });
  assert.equal(boardQueryString({ tab: "LIFE", tier: null, sort: "default", page: 1 }), "tab=LIFE");
  assert.equal(parseItemId("66102006"), 66102006);
  assert.equal(parseItemId("0"), null);
  assert.equal(parseItemId("12a"), null);
});

test("change labels and gold text follow the board's units", () => {
  assert.deepEqual(changeLabel(1.14), { text: "▲1.1%", direction: "up" });
  assert.deepEqual(changeLabel(-0.7), { text: "▼0.7%", direction: "down" });
  assert.deepEqual(changeLabel(0), { text: "0.0%", direction: "flat" });
  assert.deepEqual(changeLabel(null), { text: "—", direction: "none" });
  assert.equal(goldText(192.9), "192.9G");
  assert.equal(goldText(null), "—");
});

test("history charts use completed days, oldest first", () => {
  const variant = fixture("market-item-history.json").data.variants[0];
  const days = completedDays(variant, 7);
  assert.equal(days.length, 7);
  assert.ok(days.every((day) => !day.partial));
  assert.ok(days[0].date < days.at(-1)!.date);
});

test("board and history requests validate input and pass through allow-listed errors", async () => {
  let calls = 0;
  const fetcher = (async (url: URL) => {
    calls++;
    if (url.pathname.endsWith("/history")) return Response.json(fixture("market-item-history.json"));
    assert.equal(url.pathname, "/api/v1/markets/board");
    assert.equal(url.searchParams.get("tab"), "ENGRAVING_BOOK");
    return Response.json(fixture("market-board.json"));
  }) as unknown as typeof fetch;
  assert.equal((await requestBoard(new URLSearchParams("tab=ENGRAVING_BOOK&sort=rise"), origin, { fetcher })).ok, true);
  assert.equal((await requestBoard(new URLSearchParams("tab=GEM"), origin, { fetcher })).ok, false);
  assert.equal((await requestItemHistory("66102006", origin, { fetcher })).ok, true);
  assert.equal((await requestItemHistory("-1", origin, { fetcher })).ok, false);
  assert.equal(calls, 2);
  const missing = await requestItemHistory("123", origin, {
    fetcher: (async () => Response.json({ code: "MARKET_ITEM_NOT_FOUND" }, { status: 404 })) as typeof fetch,
  });
  assert.deepEqual(missing.ok ? null : missing.error, { code: "MARKET_ITEM_NOT_FOUND", status: 404 });
});

test("unit price, gold change with rate, and honest update age", () => {
  assert.equal(unitPrice(195, 10), 19.5);
  assert.equal(unitPrice(195, 1), null);
  assert.equal(unitPrice(null, 10), null);
  assert.deepEqual(changeWithAmount({ currentMinPrice: 195, yesterdayAvgPrice: 186.2, changeDay: 4.73 }), {
    text: "▲8.8 (4.7%)",
    direction: "up",
  });
  assert.deepEqual(changeWithAmount({ currentMinPrice: 171, yesterdayAvgPrice: null, changeDay: -2.4 }), {
    text: "▼2.4%",
    direction: "down",
  });
  const now = Date.parse("2026-10-09T12:00:00Z");
  assert.equal(updatedAgo("2026-10-09T11:59:40Z", now), "방금 갱신");
  assert.equal(updatedAgo("2026-10-09T11:57:00Z", now), "3분 전 갱신");
  assert.equal(updatedAgo("2026-10-09T09:30:00Z", now), "2시간 전 갱신");
});

test("market favourites toggle newest first and drop malformed entries", () => {
  const item = { itemId: 66102006, name: "아비도스 융화 재료", tab: "REFINING" as const, tier: 4, icon: null, grade: "희귀" };
  const added = toggleFavorite([], item);
  assert.equal(added.length, 1);
  assert.deepEqual(toggleFavorite(added, item), []);
  assert.deepEqual(parseFavorites(JSON.stringify([item, { itemId: -1 }, { ...item, tab: "GEM" }])).length, 1);
  assert.deepEqual(parseFavorites("oops"), []);
});
