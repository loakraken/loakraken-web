import assert from "node:assert/strict";
import test from "node:test";
import { coverageText, parseSearchRequest, polishValue, slotOptions } from "../lib/accessory-search/model";
import { requestAccessorySearch } from "../lib/accessory-search/upstream";

const origin = "http://backend.test";
const ok = (data: object) =>
  new Response(JSON.stringify({ code: "AUCTION_SEARCH_SUCCESS", message: "ok", data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
const result = {
  ruleVersion: "accessory-search-v1",
  totalCount: 245,
  page: 1,
  observedAt: "2026-10-12T03:00:00Z",
  cached: false,
  complete: false,
  scannedPages: 3,
  nextPage: 4,
  items: [
    {
      name: "테스트 목걸이",
      grade: "고대",
      quality: 90,
      polish: [{ name: "적에게 주는 피해 증가", option: "ENEMY_DAMAGE", shortName: "적주피", value: 2, percentage: true, level: "HIGH" }],
      polishStage: 1,
      enlightenment: 4,
      mainStat: 15000,
      mainStatRangePct: 72.5,
      tradeAllowCount: 0,
      buyPrice: null,
      bidStartPrice: 900000,
      endDate: "2026-10-14T12:00:00Z",
      icon: null,
      baseEffects: [],
    },
  ],
};

test("requests the backend refuses never leave the proxy (INVALID_AUCTION_FILTER rules)", () => {
  const base = { slot: "NECKLACE", grade: "ANCIENT" };
  assert.deepEqual(parseSearchRequest({ ...base, polish: [{ option: "ENEMY_DAMAGE", level: "HIGH" }], enlightenmentMin: 13 }), {
    slot: "NECKLACE",
    grade: "ANCIENT",
    polish: [{ option: "ENEMY_DAMAGE", level: "HIGH" }],
    enlightenmentMin: 13,
    mainStatRangeMinPct: null,
    minQuality: null,
    sort: "BUY_PRICE",
    page: 1,
  });
  // A ring effect on a necklace, the same effect twice, enlightenment over the cap,
  // a fourth line, page 11.
  assert.equal(parseSearchRequest({ ...base, polish: [{ option: "CRIT_RATE" }] }), null);
  assert.equal(parseSearchRequest({ ...base, polish: [{ option: "BRAND" }, { option: "BRAND" }] }), null);
  assert.equal(parseSearchRequest({ ...base, grade: "RELIC", enlightenmentMin: 11 }), null);
  assert.equal(parseSearchRequest({ ...base, polish: [{ option: "BRAND" }, { option: "ENEMY_DAMAGE" }, { option: "ADDITIONAL_DAMAGE" }, { option: "IDENTITY_GAUGE" }] }), null);
  assert.equal(parseSearchRequest({ ...base, page: 11 }), null);
  assert.deepEqual(slotOptions("EARRING"), ["WEAPON_ATTACK_PERCENT", "ATTACK_PERCENT"]);
});

test("a partial page range says what it covers; the official count is never a total", () => {
  assert.equal(coverageText({ complete: false, scannedPages: 3 }, 3), "찾은 페이지 안의 결과예요(3쪽 읽음)");
  assert.equal(coverageText({ complete: true, scannedPages: 1 }, 1), null);
  assert.equal(polishValue({ name: "", option: null, shortName: null, value: 2, percentage: true, level: "HIGH" }), "2.00%");
  assert.equal(polishValue({ name: "", option: null, shortName: null, value: 3250, percentage: false, level: null }), "+3,250");
});

test("the proxy validates the answer against the contract and passes a busy 503 with its wait", async () => {
  const good = await requestAccessorySearch({ slot: "NECKLACE", grade: "ANCIENT" }, origin, {
    fetcher: async (url, init) => {
      assert.equal(String(url), `${origin}/api/v1/markets/auctions/accessories/search`);
      assert.equal(JSON.parse(String(init?.body)).sort, "BUY_PRICE");
      return ok(result);
    },
  });
  assert.equal(good.ok && good.envelope.data.items[0].buyPrice, null);

  const busy = await requestAccessorySearch({ slot: "RING", grade: "RELIC" }, origin, {
    fetcher: async () =>
      new Response(JSON.stringify({ code: "MARKET_SEARCH_BUSY", message: "", data: null }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Retry-After": "30" },
      }),
  });
  assert.equal(busy.ok, false);
  if (!busy.ok) {
    assert.equal(busy.error.code, "MARKET_SEARCH_BUSY");
    assert.ok(busy.error.retryAt && busy.error.retryAt > Date.now() + 25_000);
  }

  const limited = await requestAccessorySearch({ slot: "RING", grade: "RELIC" }, origin, {
    fetcher: async () =>
      new Response(JSON.stringify({ code: "CLIENT_RATE_LIMITED", message: "", data: null }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "10" },
      }),
  });
  assert.ok(!limited.ok && limited.error.code === "LOST_ARK_RATE_LIMITED" && limited.error.status === 429);

  const invalid = await requestAccessorySearch({ slot: "NECKLACE", grade: "ANCIENT" }, origin, {
    fetcher: async () => ok({ ...result, items: [{ name: 1 }] }),
  });
  assert.ok(!invalid.ok && invalid.error.code === "INVALID_API_RESPONSE");
});
