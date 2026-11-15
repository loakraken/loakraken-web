import assert from "node:assert/strict";
import test from "node:test";
import { isGemHistoryEnvelope, requestGemHistory } from "../lib/market/auction-gems.backend";
import { isAccessoryHistoryEnvelope } from "../lib/market/auction-accessories.backend";
import { completedCellDays, parseCellRange, shortOf } from "../lib/market/cell-history";

const day = (date: string, partial = false) => ({
  date,
  minBuyPrice: 120000,
  totalCount: 31,
  observedAt: `${date}T10:00:00Z`,
  partial,
});
const history = (code: string) => ({
  code,
  message: "성공",
  data: {
    ruleVersion: "auction-board-v1",
    range: "90d",
    recordedSince: "2026-10-01",
    storedDays: 3,
    days: [day("2026-11-13", true), day("2026-11-12"), day("2026-11-10")],
  },
});

test("cell history (api #920): the contract shape with each board's own success code", () => {
  assert.equal(isGemHistoryEnvelope(history("AUCTION_GEMS_SUCCESS")), true);
  assert.equal(isGemHistoryEnvelope(history("AUCTION_ACCESSORIES_SUCCESS")), false);
  assert.equal(isAccessoryHistoryEnvelope(history("AUCTION_ACCESSORIES_SUCCESS")), true);
  // recordedSince may be null (nothing stored yet); a day without its price is not a reading.
  const none = history("AUCTION_GEMS_SUCCESS");
  none.data.recordedSince = null as unknown as string;
  assert.equal(isGemHistoryEnvelope(none), true);
  const broken = history("AUCTION_GEMS_SUCCESS");
  delete (broken.data.days[1] as Partial<ReturnType<typeof day>>).minBuyPrice;
  assert.equal(isGemHistoryEnvelope(broken), false);
});

test("cell history: oldest first without today's partial reading; short ranges say how many days", () => {
  const days = completedCellDays(history("AUCTION_GEMS_SUCCESS").data);
  assert.deepEqual(days.map((d) => d.date), ["2026-11-10", "2026-11-12"]);
  assert.equal(shortOf(days, 90), 2);
  assert.equal(shortOf(Array.from({ length: 29 }, (_, i) => day(`2026-10-${String(i + 1).padStart(2, "0")}`)), 30), null);
  assert.equal(shortOf(days, 7), null, "7일 never says it");
  assert.equal(parseCellRange("365d"), "365d");
  assert.equal(parseCellRange("999d"), null);
  assert.equal(parseCellRange(null), null);
});

test("gem history request: kind, level and range go to the api", async () => {
  let seen: URL | null = null;
  const fetcher = (async (url: URL) => {
    seen = url;
    return Response.json(history("AUCTION_GEMS_SUCCESS"));
  }) as unknown as typeof fetch;
  const result = await requestGemHistory({ kind: "겁화", level: 10 }, "90d", "http://backend.test", { fetcher });
  assert.equal(result.ok, true);
  assert.equal(seen!.pathname, "/api/v1/markets/auctions/gems/history");
  assert.equal(seen!.searchParams.get("kind"), "겁화");
  assert.equal(seen!.searchParams.get("level"), "10");
  assert.equal(seen!.searchParams.get("range"), "90d");
});
