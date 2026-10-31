import assert from "node:assert/strict";
import test from "node:test";
import sample from "./stats-fixtures/stats-gem-levels.json";
import { gemBinLabel, isGemLevelsEnvelope, requestGemLevels } from "../lib/stats/gem-levels";

// The backend's own answer (api #782 @a1debc3): 12 bins summing to gemSample.
test("gem levels: the backend sample fits the contract, bins sum to gemSample", () => {
  assert.equal(isGemLevelsEnvelope(sample), true);
  assert.equal(sample.data.bins.length, 12);
  assert.equal(
    sample.data.bins.reduce((sum, bin) => sum + bin.count, 0),
    sample.data.gemSample,
  );
  assert.equal(isGemLevelsEnvelope({ ...sample, code: "STATS_CLASSES_SUCCESS" }), false);
});

test("gem levels: bin names", () => {
  assert.deepEqual(
    sample.data.bins.map(gemBinLabel),
    ["5 미만", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0", "9.5", "10.0"],
  );
});

test("gem levels request: backend path and the stats filters only", async () => {
  let asked = "";
  const fetcher = (async (input: RequestInfo | URL) => {
    asked = String(input);
    return new Response(JSON.stringify(sample), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const result = await requestGemLevels({ server: "아만", metric: "ITEM_LEVEL", width: 5 }, "http://backend.test", { fetcher });
  const url = new URL(asked);
  assert.equal(url.pathname, "/api/v1/stats/gem-levels");
  assert.equal(url.searchParams.get("server"), "아만");
  assert.equal(url.searchParams.has("metric"), false);
  assert.equal(result.ok, true);
});

test("gem levels request: an api without the endpoint answers 404, kept as 404 (the chart is left out)", async () => {
  const fetcher = (async () => new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404, headers: { "content-type": "application/json" } })) as typeof fetch;
  const result = await requestGemLevels({}, "http://backend.test", { fetcher });
  assert.deepEqual(result, { ok: false, error: { code: "NOT_FOUND", status: 404 } });
});
