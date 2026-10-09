import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  STATS_VIEWS,
  isStatsEnvelope,
  parseStatsQuery,
  quantileScale,
  sampleText,
  statsSearch,
} from "../lib/stats/model";
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
