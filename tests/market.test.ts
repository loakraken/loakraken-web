import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  formatGold,
  itemSearchParams,
  parsePriceRequest,
  parseQuantity,
  parseQuoteRequest,
  quantityError,
  searchError,
} from "../lib/market/model";
import {
  isItemsEnvelope,
  isOptionsEnvelope,
  isPricesEnvelope,
  isQuoteEnvelope,
} from "../lib/market/validate";
import {
  requestItems,
  requestPrices,
  requestQuote,
} from "../lib/market/upstream";

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`./market-fixtures/${name}`, import.meta.url), "utf8"),
  );
const origin = "http://127.0.0.1:8080";
const item = {
  itemId: 123,
  requiredQuantity: 250,
  ownedQuantity: 40,
  search: { categoryCode: 50000, itemName: " 검증 재료 ", pageNo: 1 },
};

test("backend-generated market fixtures satisfy the captured contract", () => {
  assert.equal(isOptionsEnvelope(fixture("market-options.json")), true);
  assert.equal(isItemsEnvelope(fixture("market-items.json")), true);
  assert.equal(isQuoteEnvelope(fixture("material-quote.json")), true);
  assert.equal(
    isQuoteEnvelope(fixture("material-quote-incomplete.json")),
    true,
  );
  const broken = fixture("material-quote.json");
  delete broken.data.totalCostGold;
  assert.equal(
    isQuoteEnvelope(broken),
    false,
    "nullable fields are never omitted",
  );
  assert.equal(isQuoteEnvelope(fixture("market-items.json")), false);
});

test("quantities are whole numbers within the backend range; decimals are rejected, not truncated", () => {
  assert.equal(parseQuantity("0"), 0);
  assert.equal(parseQuantity(" 999999999 "), 999_999_999);
  for (const value of ["", "-1", "1.5", "1,000", "1e3", "1000000000", "abc"])
    assert.equal(parseQuantity(value), null, value);
  assert.match(quantityError("2.5"), /정수/);
  assert.equal(quantityError("12"), "");
});

test("search input requires a category and a 1-64 character NFC name", () => {
  assert.notEqual(searchError(null, "재료"), "");
  assert.notEqual(searchError(50000, "   "), "");
  assert.notEqual(searchError(50000, "가".repeat(65)), "");
  assert.equal(searchError(50000, "재료"), "");
});

test("item search query is allow-listed and range-checked before any backend call", () => {
  const ok = itemSearchParams(
    new URLSearchParams(
      "categoryCode=50000&itemName= 재료 &pageNo=2&sort=CURRENT_MIN_PRICE&evil=1",
    ),
  );
  assert.equal(
    ok?.toString(),
    new URLSearchParams({
      categoryCode: "50000",
      itemName: "재료",
      pageNo: "2",
      sort: "CURRENT_MIN_PRICE",
    }).toString(),
  );
  for (const query of [
    "",
    "categoryCode=0",
    "categoryCode=1.5",
    "categoryCode=5&pageNo=1001",
    "categoryCode=5&sort=NAME",
  ])
    assert.equal(itemSearchParams(new URLSearchParams(query)), null, query);
});

test("quote requests are re-shaped and reject duplicates, decimals, empty and oversized lists", () => {
  const parsed = parseQuoteRequest({
    priceBasis: "RECENT_PRICE",
    items: [{ ...item, extra: true }],
  });
  assert.deepEqual(parsed, {
    priceBasis: "RECENT_PRICE",
    items: [
      {
        ...item,
        search: { categoryCode: 50000, itemName: "검증 재료", pageNo: 1 },
      },
    ],
  });
  const bad = [
    { priceBasis: "CHEAPEST", items: [item] },
    { priceBasis: "RECENT_PRICE", items: [] },
    {
      priceBasis: "RECENT_PRICE",
      items: Array.from({ length: 11 }, (_, i) => ({ ...item, itemId: i + 1 })),
    },
    { priceBasis: "RECENT_PRICE", items: [item, item] },
    { priceBasis: "RECENT_PRICE", items: [{ ...item, requiredQuantity: 1.5 }] },
    { priceBasis: "RECENT_PRICE", items: [{ ...item, itemId: "123" }] },
    {
      priceBasis: "RECENT_PRICE",
      items: [
        { ...item, search: { categoryCode: 50000, itemName: "x", pageNo: 0 } },
      ],
    },
  ];
  for (const body of bad)
    assert.equal(
      parseQuoteRequest(body),
      null,
      JSON.stringify(body).slice(0, 60),
    );
});

test("invalid requests never reach the backend; a valid quote is one POST with JSON numbers", async () => {
  let calls = 0;
  const never = (async () => {
    calls++;
    return Response.json({});
  }) as typeof fetch;
  assert.deepEqual(
    (
      await requestQuote({ priceBasis: "X", items: [] }, origin, {
        fetcher: never,
      })
    ).ok,
    false,
  );
  assert.deepEqual(
    (
      await requestItems(new URLSearchParams("categoryCode=-1"), origin, {
        fetcher: never,
      })
    ).ok,
    false,
  );
  assert.equal(calls, 0);

  let seen: { url: string; method?: string; body?: string } | undefined;
  const capture = (async (url: URL, init: RequestInit) => {
    seen = { url: String(url), method: init.method, body: String(init.body) };
    return Response.json(fixture("material-quote.json"));
  }) as unknown as typeof fetch;
  const result = await requestQuote(
    { priceBasis: "CURRENT_MIN_PRICE", items: [item] },
    origin,
    { fetcher: capture },
  );
  assert.equal(result.ok, true);
  assert.equal(seen?.url, `${origin}/api/v1/markets/material-quotes`);
  assert.equal(seen?.method, "POST");
  assert.equal(JSON.parse(seen?.body ?? "{}").items[0].itemId, 123);
});

test("market errors map to allow-listed codes; 429 carries a retry time and upstream text never leaks", async () => {
  const reply = (body: unknown, status: number, headers = {}) =>
    (async () => Response.json(body, { status, headers })) as typeof fetch;
  const limited = await requestItems(
    new URLSearchParams("categoryCode=50000"),
    origin,
    {
      fetcher: reply(
        { code: "LOST_ARK_RATE_LIMITED", message: "secret" },
        429,
        { "Retry-After": "5" },
      ),
    },
  );
  assert.equal(limited.ok, false);
  if (!limited.ok) {
    assert.equal(limited.error.code, "LOST_ARK_RATE_LIMITED");
    assert.ok((limited.error.retryAt ?? 0) > Date.now());
  }
  const cache = await requestItems(
    new URLSearchParams("categoryCode=50000"),
    origin,
    {
      fetcher: reply({ code: "MARKET_CACHE_UNAVAILABLE" }, 503),
    },
  );
  assert.deepEqual(cache.ok ? null : cache.error, {
    code: "MARKET_CACHE_UNAVAILABLE",
    status: 503,
  });
  const odd = await requestItems(
    new URLSearchParams("categoryCode=50000"),
    origin,
    {
      fetcher: reply(
        { code: "SOMETHING_INTERNAL", message: "stack trace" },
        500,
      ),
    },
  );
  assert.deepEqual(odd.ok ? null : odd.error, {
    code: "LOST_ARK_API_ERROR",
    status: 502,
  });
  const notConfigured = await requestItems(
    new URLSearchParams("categoryCode=50000"),
    undefined,
  );
  assert.deepEqual(notConfigured.ok ? null : notConfigured.error, {
    code: "FRONTEND_API_NOT_CONFIGURED",
    status: 503,
  });
});

test("gold display keeps up to two decimals and marks unknown totals", () => {
  assert.equal(formatGold(1234), "1,234");
  assert.equal(formatGold(12.345), "12.35");
  assert.equal(formatGold(0), "0");
  assert.equal(formatGold(null), "—");
});

test("material price requests are allow-listed and validated", async () => {
  assert.equal(isPricesEnvelope(fixture("material-prices.json")), true);
  const broken = fixture("material-prices.json");
  broken.data.items[0].status = 3;
  assert.equal(isPricesEnvelope(broken), false);
  assert.deepEqual(
    parsePriceRequest({ priceBasis: "RECENT_PRICE", names: [" 운명의 파편 ", "운명의 파편"], extra: 1 }),
    { priceBasis: "RECENT_PRICE", names: ["운명의 파편"] },
  );
  for (const bad of [
    { priceBasis: "CHEAPEST", names: ["a"] },
    { priceBasis: "RECENT_PRICE", names: [] },
    { priceBasis: "RECENT_PRICE", names: [""] },
    { priceBasis: "RECENT_PRICE", names: ["가".repeat(65)] },
    { priceBasis: "RECENT_PRICE", names: Array.from({ length: 21 }, (_, i) => `재료${i}`) },
    { priceBasis: "RECENT_PRICE", names: [3] },
  ])
    assert.equal(parsePriceRequest(bad), null, JSON.stringify(bad).slice(0, 60));
  let calls = 0;
  const fetcher = (async (url: URL, init: RequestInit) => {
    calls++;
    assert.equal(url.pathname, "/api/v1/markets/material-prices");
    assert.deepEqual(JSON.parse(String(init.body)).names, ["운명의 수호석"]);
    return Response.json(fixture("material-prices.json"));
  }) as unknown as typeof fetch;
  const body = { priceBasis: "CURRENT_MIN_PRICE", names: ["운명의 수호석"] };
  assert.equal((await requestPrices(body, "http://127.0.0.1:8080", { fetcher })).ok, true);
  assert.equal((await requestPrices({}, "http://127.0.0.1:8080", { fetcher })).ok, false);
  assert.equal(calls, 1);
});
