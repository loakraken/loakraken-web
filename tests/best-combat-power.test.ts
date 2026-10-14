import assert from "node:assert/strict";
import test from "node:test";
import { bestCombatPowerSearch, requestBestCombatPower } from "../lib/stats/best-combat-power";

test("best combat power: the stats filters go on, the distribution's own do not", () => {
  const search = bestCombatPowerSearch({ server: "루페온", role: "SUPPORT", activeDays: 7, combatPowerMin: 2000, metric: "ITEM_LEVEL", width: 5, percentileOf: 1700 });
  assert.equal(search.get("server"), "루페온");
  assert.equal(search.get("role"), "SUPPORT");
  assert.equal(search.get("activeDays"), "7");
  assert.equal(search.get("combatPowerMin"), "2000");
  assert.equal(search.has("metric"), false);
  assert.equal(search.has("width"), false);
  assert.equal(search.has("percentileOf"), false);
});

test("best combat power request: backend path, filters and its success code", async () => {
  let asked = "";
  const body = { code: "STATS_CLASSES_SUCCESS", message: "", data: null };
  const fetcher = (async (input: RequestInfo | URL) => {
    asked = String(input);
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const result = await requestBestCombatPower({ server: "아만" }, "http://backend.test", { fetcher });
  const url = new URL(asked);
  assert.equal(url.pathname, "/api/v1/stats/best-combat-power");
  assert.equal(url.searchParams.get("server"), "아만");
  // Another view's answer is not taken as this one's.
  assert.equal(result.ok, false);
});
