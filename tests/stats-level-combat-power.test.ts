import assert from "node:assert/strict";
import test from "node:test";
import sample from "./fixtures/stats/level-combat-power.json";
import { isLevelCombatPowerEnvelope, linePoints, requestLevelCombatPower } from "../lib/stats/level-combat-power";

// The backend's own answer (api #784 @5d5a840): a bucket under 30 has no median.
test("level combat power: the backend sample fits the contract", () => {
  assert.equal(isLevelCombatPowerEnvelope(sample), true);
  assert.equal(
    sample.data.buckets.reduce((sum, b) => sum + b.count, 0),
    sample.data.meta.population,
  );
  assert.equal(isLevelCombatPowerEnvelope({ ...sample, code: "STATS_GEM_LEVELS_SUCCESS" }), false);
});

const bucket = (from: number, median: number | null, count = 40) => ({ from, to: from + 5, count, median });

test("level combat power line: x by level, y by median, no point for a short bucket", () => {
  const { points, path, lo, hi } = linePoints([bucket(1680, 2800), bucket(1685, null, 12), bucket(1690, 3200), bucket(1695, 3000)], 300, 100, 10);
  assert.deepEqual(points.map((p) => Math.round(p.x)), [38, 113, 188, 263]);
  assert.equal(points[1].y, null);
  // Highest median at the top pad, lowest at the bottom pad.
  assert.equal(points[2].y, 10);
  assert.equal(points[0].y, 90);
  assert.deepEqual([lo, hi], [2800, 3200]);
  // The line breaks at the short bucket: a new M after it, no L across it.
  assert.equal(path, "M37.5 90.0M187.5 10.0L262.5 50.0");
});

test("level combat power line: one median or none at all", () => {
  const one = linePoints([bucket(1700, 3100)], 200, 100);
  assert.equal(one.points[0].y, 92);
  assert.equal(one.path, "M100.0 92.0");
  const none = linePoints([bucket(1700, null, 3)], 200, 100);
  assert.equal(none.path, "");
  assert.equal(none.lo, null);
});

test("level combat power request: backend path and the stats filters only", async () => {
  let asked = "";
  const fetcher = (async (input: RequestInfo | URL) => {
    asked = String(input);
    return new Response(JSON.stringify(sample), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const result = await requestLevelCombatPower({ role: "DEALER", percentileOf: 3000 }, "http://backend.test", { fetcher });
  const url = new URL(asked);
  assert.equal(url.pathname, "/api/v1/stats/level-combat-power");
  assert.equal(url.searchParams.get("role"), "DEALER");
  assert.equal(url.searchParams.has("percentileOf"), false);
  assert.equal(result.ok, true);
});

test("level combat power request: 404 stays 404, other failures are not", async () => {
  const answer = (status: number) => (async () => new Response("<html>", { status })) as typeof fetch;
  const absent = await requestLevelCombatPower({}, "http://backend.test", { fetcher: answer(404) });
  assert.equal(absent.ok === false && absent.error.status, 404);
  const broken = await requestLevelCombatPower({}, "http://backend.test", { fetcher: answer(500) });
  assert.equal(broken.ok === false && broken.error.status, 502);
});
