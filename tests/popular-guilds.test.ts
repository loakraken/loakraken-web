import assert from "node:assert/strict";
import test from "node:test";
import { parsePopularGuildsQuery, popularGuildsSearch } from "../lib/stats/popular-guilds";
import { isPopularGuildsEnvelope, requestPopularGuilds } from "../lib/stats/popular-guilds.backend";
import { isPopularGuildsEnabled } from "../lib/tools/flags";
import { PRODUCTION_URL } from "../lib/site";

const ok = {
  code: "GUILD_POPULAR_SUCCESS",
  message: "ok",
  data: {
    period: "24h",
    aggregatedAt: "2026-10-13T07:00:00Z",
    sampleStatus: "READY",
    ruleVersion: "popular-guild-v1",
    items: [
      { rank: 1, serverName: "아만", guildName: "합성길드" },
      { rank: 2, serverName: "카단", guildName: "다른길드" },
    ],
  },
};

test("popular guilds query: defaults, period and server, unknown values", () => {
  assert.deepEqual(parsePopularGuildsQuery(new URLSearchParams("")), { period: "24h", server: undefined });
  const q = parsePopularGuildsQuery(new URLSearchParams("period=7d&server=아만"));
  assert.deepEqual(q, { period: "7d", server: "아만" });
  assert.equal(popularGuildsSearch(q).toString(), new URLSearchParams("period=7d&server=아만").toString());
  assert.deepEqual(parsePopularGuildsQuery(new URLSearchParams("period=30d&server=<x>")), { period: "24h", server: undefined });
});

test("popular guilds envelope follows the contract: rank, server and guild only", () => {
  assert.equal(isPopularGuildsEnvelope(ok), true);
  assert.equal(isPopularGuildsEnvelope({ ...ok, data: { ...ok.data, sampleStatus: "COLLECTING", items: [] } }), true);
  assert.equal(isPopularGuildsEnvelope({ ...ok, code: "CHARACTER_POPULAR_SUCCESS" }), false);
  assert.equal(isPopularGuildsEnvelope({ ...ok, data: { ...ok.data, items: [{ rank: "1", serverName: "아만", guildName: "합성길드" }] } }), false);
});

test("popular guilds request: ten rows, the period and server passed on", async () => {
  let asked = "";
  const fetcher = (async (input: RequestInfo | URL) => {
    asked = String(input);
    return new Response(JSON.stringify(ok), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const result = await requestPopularGuilds({ period: "7d", server: "아만" }, "http://backend.test", { fetcher });
  assert.equal(result.ok, true);
  const url = new URL(asked);
  assert.equal(url.pathname, "/api/v1/guilds/popular");
  assert.equal(url.searchParams.get("period"), "7d");
  assert.equal(url.searchParams.get("server"), "아만");
  assert.equal(url.searchParams.get("limit"), "10");
});

test("popular guilds card: on unless turned off, hidden on the production host", () => {
  assert.equal(isPopularGuildsEnabled({}), true);
  assert.equal(isPopularGuildsEnabled({ POPULAR_GUILDS: "off" }), false);
  assert.equal(isPopularGuildsEnabled({ SITE_URL: PRODUCTION_URL }), false);
  assert.equal(isPopularGuildsEnabled({ SITE_URL: PRODUCTION_URL, POPULAR_GUILDS: "on" }), true);
});
