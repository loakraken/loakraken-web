import assert from "node:assert/strict";
import test from "node:test";
import { minuteLabel, parseMinuteItemId, sampleText } from "../lib/market/minutes";
import { requestItemMinutes } from "../lib/market/minutes.backend";

test("minute chart: item id as the backend allows, the last hour asked", async () => {
  assert.equal(parseMinuteItemId("6861012"), 6861012);
  assert.equal(parseMinuteItemId("0"), null);
  assert.equal(parseMinuteItemId("1000000000"), null);
  assert.equal(parseMinuteItemId("12a"), null);
  let asked = "";
  const fetcher = (async (input: RequestInfo | URL) => {
    asked = String(input);
    return new Response(JSON.stringify({ code: "INVALID_REQUEST", message: "", data: null }), { status: 400 });
  }) as typeof fetch;
  await requestItemMinutes(6861012, "http://backend.test", { fetcher });
  const url = new URL(asked);
  assert.equal(url.pathname, "/api/v1/markets/items/6861012/minutes");
  assert.equal(url.searchParams.get("minutes"), "60");
});

test("minute chart: how often an item is fetched, and the minute in Korea time", () => {
  assert.equal(sampleText(30), "약 30초마다 확인");
  assert.equal(sampleText(600), "약 10분마다 확인");
  assert.equal(sampleText(1800), "약 30분마다 확인");
  assert.equal(sampleText(null), null);
  assert.equal(minuteLabel("2026-10-14T05:05:00Z"), "14:05");
});
