import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { share, STATS_VIEWS, parseDistributionView, parseStatsQuery, withoutDistributionView, writeDistributionView, quantileScale, sampleText, statsKey, statsSearch } from "../lib/stats/model";
import { isStatsEnvelope } from "../lib/stats/model.backend";
import { requestStats } from "../lib/stats/upstream";

const fixture = (view: string) =>
  JSON.parse(readFileSync(new URL(`./stats-fixtures/stats-${view}.json`, import.meta.url), "utf8"));

test("backend samples of every view satisfy the captured contract", () => {
  for (const view of STATS_VIEWS) assert.equal(isStatsEnvelope(view, fixture(view)), true, view);
  assert.equal(isStatsEnvelope("classes", fixture("summary")), false);
  const broken = fixture("classes");
  broken.data.rows[0].count = "35명";
  assert.equal(isStatsEnvelope("classes", broken), false);
  // A tier the build does not know keeps the distribution.
  const newer = fixture("distribution");
  newer.data.percentileOf.tier = "TOP3";
  assert.equal(isStatsEnvelope("distribution", newer), true);
});

test("filters are allow-listed; any invalid value rejects the query", () => {
  assert.deepEqual(
    parseStatsQuery(new URLSearchParams("server=아만&role=SUPPORT&activeDays=7&itemLevelMin=1680&representativeOnly=true&x=1")),
    { server: "아만", role: "SUPPORT", activeDays: 7, itemLevelMin: 1680, representativeOnly: true },
  );
  assert.deepEqual(parseStatsQuery(new URLSearchParams("")), {});
  for (const bad of ["role=TANK", "activeDays=14", "itemLevelMin=3000", "server=아만%20서버", "metric=GOLD", "width=0", "percentileOf=-1"])
    assert.equal(parseStatsQuery(new URLSearchParams(bad)), null, bad);
  assert.equal(statsSearch({ server: "아만", activeDays: 30 }).toString(), "server=%EC%95%84%EB%A7%8C&activeDays=30");
});

test("an inverted range is dropped (the api answers 400), the other filters stay", () => {
  assert.deepEqual(parseStatsQuery(new URLSearchParams("role=DEALER&combatPowerMin=5000&combatPowerMax=1000")), { role: "DEALER" });
  assert.deepEqual(parseStatsQuery(new URLSearchParams("itemLevelMin=1720&itemLevelMax=1700&combatPowerMin=1000")), { combatPowerMin: 1000 });
  // Equal bounds are a valid one-value range.
  assert.deepEqual(parseStatsQuery(new URLSearchParams("combatPowerMin=3000&combatPowerMax=3000")), { combatPowerMin: 3000, combatPowerMax: 3000 });
});

test("the distribution tab's choices ride in the address apart from the filters", () => {
  const parse = (s: string) => parseDistributionView(new URLSearchParams(s));
  assert.deepEqual(parse(""), { metric: "COMBAT_POWER", asTable: false });
  assert.deepEqual(parse("metric=ITEM_LEVEL&percentileOf=1720.5&view=table"), { metric: "ITEM_LEVEL", percentileOf: 1720.5, asTable: true });
  // A bad value drops only itself.
  assert.deepEqual(parse("metric=GOLD&percentileOf=-1&view=grid"), { metric: "COMBAT_POWER", asTable: false });
  const params = new URLSearchParams("tab=distribution&role=DEALER&view=table&metric=ITEM_LEVEL");
  writeDistributionView({ metric: "COMBAT_POWER", percentileOf: 3000, asTable: false }, params);
  assert.equal(params.toString(), "tab=distribution&role=DEALER&percentileOf=3000");
  // The filters parse without them, so a bad typed value never resets a filter.
  const filters = withoutDistributionView(new URLSearchParams("role=SUPPORT&percentileOf=-5&metric=GOLD&width=7&view=x"));
  assert.deepEqual(parseStatsQuery(filters), { role: "SUPPORT" });
});
test("one cache entry per set of conditions: 30 days is the default, order does not matter (#540 P2)", () => {
  assert.equal(statsKey({}), statsKey({ activeDays: 30 }));
  assert.equal(statsKey({ server: "아만", role: "DEALER" }), statsKey({ role: "DEALER", server: "아만", activeDays: 30 }));
  assert.notEqual(statsKey({ activeDays: 7 }), statsKey({}));
});

test("the sample is described as LOAKraken's, never the whole game", () => {
  assert.equal(
    sampleText(fixture("summary").data.meta),
    "최근 30일 안에 LOAKraken이 확인한 캐릭터 · 아이템 레벨 1,640 이상 · 통계테스트서버 40명 기준",
  );
});

test("quantile bars share one scale; collecting rows have none", () => {
  const rows = fixture("classes").data.rows;
  const scale = quantileScale(rows)!;
  assert.equal(scale(3034), 0);
  assert.equal(scale(3306), 100);
  assert.equal(quantileScale(rows.filter((r: { combatPower: unknown }) => !r.combatPower)), null);
});

test("requests pass only the view's own parameters and need a metric for the distribution", async () => {
  const seen: URL[] = [];
  const fetcher = (async (input: URL) => {
    seen.push(input);
    return Response.json({ code: "STATS_UNAVAILABLE", message: "secret" }, { status: 503 });
  }) as unknown as typeof fetch;
  const origin = "http://127.0.0.1:8080";
  assert.deepEqual(await requestStats("distribution", {}, origin, { fetcher }), {
    ok: false,
    error: { code: "INVALID_REQUEST", status: 400 },
  });
  assert.equal(seen.length, 0);
  await requestStats("summary", { server: "아만", metric: "ITEM_LEVEL", percentileOf: 1700 }, origin, { fetcher });
  assert.equal(seen[0].pathname, "/api/v1/stats/summary");
  assert.equal(seen[0].search, "?server=%EC%95%84%EB%A7%8C");
  const result = await requestStats("distribution", { metric: "ITEM_LEVEL", width: 10, percentileOf: 1700 }, origin, { fetcher });
  assert.equal(seen[1].searchParams.get("percentileOf"), "1700");
  assert.deepEqual(result, { ok: false, error: { code: "STATS_UNAVAILABLE", status: 503 } });
});

test("population share: one decimal, tiny non-zero shares are not 0%", () => {
  assert.equal(share(8.7), "8.7%");
  assert.equal(share(5), "5.0%");
  assert.equal(share(0.024), "<0.1%");
  assert.equal(share(0), "0.0%");
  assert.equal(share(null), "-");
});
