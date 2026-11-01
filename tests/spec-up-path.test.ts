import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { GoalStep } from "../lib/spec-up/goal";
import { extraCosts, isPathSort } from "../lib/spec-up/path";
import { requestSpecUpPath } from "../lib/spec-up/upstream";
import { isSpecUpPathEnabled } from "../lib/tools/flags";

const sample = JSON.parse(readFileSync(new URL("./spec-up-fixtures/character-spec-up-path.json", import.meta.url), "utf8"));
const origin = "http://backend.test";
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

test("the backend sample (api #794) passes the contract: two gem steps in order, quality folded as unpriced", async () => {
  const result = await requestSpecUpPath("스펙순서", "DELTA", origin, {
    fetcher: async (url) => {
      assert.match(String(url), /\/api\/v1\/characters\/spec-up\/path\?characterName=.+&sort=DELTA$/);
      return json(sample);
    },
  });
  assert.ok(result.ok);
  const path = result.envelope.data;
  assert.deepEqual(
    path.steps.map((s) => [s.order, s.from, s.to, s.cumulativeCost]),
    [
      [1, "8레벨", "9레벨", 600_000],
      [2, "9레벨", "10레벨", 2_600_000],
    ],
  );
  assert.deepEqual(path.unpriced.map((u) => [u.kind, u.cost.status]), [["EQUIPMENT_QUALITY", "UNKNOWN"]]);
  assert.equal(path.totalCost, 2_600_000);
});

test("no sort is the backend's default; a sort it does not take never leaves the proxy", async () => {
  const result = await requestSpecUpPath("스펙순서", null, origin, {
    fetcher: async (url) => {
      assert.doesNotMatch(String(url), /sort=/);
      return json(sample);
    },
  });
  assert.ok(result.ok);
  for (const sort of ["KRAKEN", "efficiency", ""])
    assert.deepEqual(await requestSpecUpPath("스펙순서", sort, origin, { fetcher: async () => json(sample) }), {
      ok: false,
      error: { code: "INVALID_REQUEST", status: 400 },
    });
  assert.ok(isPathSort("EFFICIENCY") && isPathSort("DELTA") && !isPathSort("KRAKEN"));
});

test("SPEC_UP_BUSY keeps its code and Retry-After; another 429 is the rate limit; 404 codes pass", async () => {
  const busy = await requestSpecUpPath("스펙순서", "EFFICIENCY", origin, {
    fetcher: async () => json({ code: "SPEC_UP_BUSY", message: "", data: null }, 429, { "Retry-After": "5" }),
  });
  assert.ok(!busy.ok && busy.error.code === "SPEC_UP_BUSY" && busy.error.status === 429 && busy.error.retryAt);
  const limited = await requestSpecUpPath("스펙순서", "EFFICIENCY", origin, {
    fetcher: async () => json({ code: "CLIENT_RATE_LIMITED", message: "", data: null }, 429, { "Retry-After": "10" }),
  });
  assert.ok(!limited.ok && limited.error.code === "LOST_ARK_RATE_LIMITED" && limited.error.limit === "client");
  const notCached = await requestSpecUpPath("스펙순서", "EFFICIENCY", origin, {
    fetcher: async () => json({ code: "CHARACTER_NOT_CACHED", message: "", data: null }, 404),
  });
  assert.ok(!notCached.ok && notCached.error.code === "CHARACTER_NOT_CACHED");
});

test("per-step cost is the api's extraCost (#794 @bde1ae4), which sums to the total; a new stop code still passes", async () => {
  const next = structuredClone(sample);
  next.data.stopReasonCode = "SOMETHING_NEW";
  const result = await requestSpecUpPath("스펙순서", "EFFICIENCY", origin, { fetcher: async () => json(next) });
  assert.ok(result.ok);
  const extras = extraCosts(result.envelope.data.steps);
  assert.deepEqual(extras, [600_000, 2_000_000]);
  assert.equal(extras.reduce((sum, v) => sum! + v!, 0), sample.data.totalCost);
  // A step without the field (an api before it) still passes the contract.
  delete next.data.steps[0].extraCost;
  assert.ok((await requestSpecUpPath("스펙순서", "EFFICIENCY", origin, { fetcher: async () => json(next) })).ok);
});

test("without extraCost (an older answer): a gem step adds its cost minus the same slot's earlier step", () => {
  const steps = (sample.data.steps as GoalStep[]).map((step) => ({ ...step, extraCost: undefined }));
  assert.deepEqual(extraCosts(steps), [600_000, 2_000_000]);
  // Prices running backwards: the next level adds 0 or less, as the api's own figure would.
  const cheaper = { ...steps[1], cost: { ...steps[1].cost, amount: 500_000 } };
  assert.deepEqual(extraCosts([steps[0], cheaper]), [600_000, -100_000]);
  // Another slot's gem and a refine step are their own cost.
  const other = { ...steps[0], candidateId: "GEM_LEVEL:3:9" };
  const refine = { ...steps[0], kind: "EQUIPMENT_REFINE", candidateId: "EQUIPMENT_REFINE:0:21" };
  assert.deepEqual(extraCosts([steps[0], other, refine, steps[1]]), [600_000, 600_000, 600_000, 2_000_000]);
  // Unknown stays unknown, never 0 — and the next stage of that slot cannot be told apart either.
  const unknown = { ...steps[0], cost: { ...steps[0].cost, status: "PENDING", amount: null } };
  assert.deepEqual(extraCosts([unknown, steps[1]]), [null, null]);
  // The backend's own figure wins when it sends one, null included.
  assert.deepEqual(extraCosts([{ ...steps[0], extraCost: null }, { ...steps[1], extraCost: 1 }]), [null, 1]);
});

test("SPEC_UP_PATH: on/off override, hidden only on production, and never without the guide", () => {
  const prod = "https://loakraken.gg";
  assert.equal(isSpecUpPathEnabled({}), true);
  assert.equal(isSpecUpPathEnabled({ SITE_URL: prod }), false);
  assert.equal(isSpecUpPathEnabled({ SITE_URL: prod, SPEC_UP_GUIDE: "on", SPEC_UP_PATH: "on" }), true);
  assert.equal(isSpecUpPathEnabled({ SPEC_UP_PATH: "off" }), false);
  assert.equal(isSpecUpPathEnabled({ SPEC_UP_GUIDE: "off", SPEC_UP_PATH: "on" }), false);
});
