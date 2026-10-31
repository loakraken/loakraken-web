import assert from "node:assert/strict";
import test from "node:test";
import sample from "./fixtures/stats/population.json";
import { isPopulationEnvelope, populationSearch, requestPopulation, snapshotText } from "../lib/stats/population";
import { isPopulationStatsEnabled } from "../lib/tools/flags";

// The backend's own answer (api #788 @f30083a).
test("population: the backend sample fits the contract; total = levels", () => {
  assert.equal(isPopulationEnvelope(sample), true);
  assert.equal(
    sample.data.levels.reduce((sum, l) => sum + l.count, 0),
    sample.data.total,
  );
  // Before the first snapshot: no date, still a valid answer.
  assert.equal(isPopulationEnvelope({ ...sample, data: { ...sample.data, snapshotDate: null } }), true);
  assert.equal(isPopulationEnvelope({ ...sample, code: "STATS_CLASSES_SUCCESS" }), false);
});

test("population: only a server goes on, and only a plausible one", () => {
  assert.equal(populationSearch("루페온").toString(), "server=%EB%A3%A8%ED%8E%98%EC%98%A8");
  assert.equal(populationSearch().size, 0);
  assert.equal(populationSearch("a b/../c").size, 0);
  assert.equal(snapshotText("2026-10-31"), "2026년 10월 31일");
});

test("population request: backend path", async () => {
  let asked = "";
  const fetcher = (async (input: RequestInfo | URL) => {
    asked = String(input);
    return new Response(JSON.stringify(sample), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const result = await requestPopulation("아만", "http://backend.test", { fetcher });
  const url = new URL(asked);
  assert.equal(url.pathname, "/api/v1/stats/population");
  assert.equal(url.searchParams.get("server"), "아만");
  assert.equal(result.ok, true);
});

test("POPULATION_STATS: on/off override, hidden on production by default", () => {
  assert.equal(isPopulationStatsEnabled({ POPULATION_STATS: "on", SITE_URL: "https://loakraken.com" }), true);
  assert.equal(isPopulationStatsEnabled({ POPULATION_STATS: "off" }), false);
  assert.equal(isPopulationStatsEnabled({ SITE_URL: "http://localhost:3000" }), true);
});
