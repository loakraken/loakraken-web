import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { GoalStep } from "../lib/spec-up/goal";
import { extraCosts, isPathSort, pathFigures, pathSortsFor, scoredAsSupporter, stepFigures } from "../lib/spec-up/path";
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
  for (const sort of ["kraken", "efficiency", ""])
    assert.deepEqual(await requestSpecUpPath("스펙순서", sort, origin, { fetcher: async () => json(sample) }), {
      ok: false,
      error: { code: "INVALID_REQUEST", status: 400 },
    });
  // KRAKEN passes since api #967/#971: the screen asks for it only where the api offered it.
  assert.ok(isPathSort("EFFICIENCY") && isPathSort("DELTA") && isPathSort("KRAKEN") && !isPathSort("kraken"));
});

test("추천 순서 by score is offered only where the api says it runs (supportOrderAvailable, api #971)", () => {
  const ids = (sorts: readonly { id: string }[]) => sorts.map((s) => s.id);
  assert.deepEqual(ids(pathSortsFor(false, false)), ["EFFICIENCY", "DELTA"], "off: the dealer's two rules, no KRAKEN");
  assert.deepEqual(ids(pathSortsFor(true, false)), ["EFFICIENCY", "DELTA", "KRAKEN"]);
  assert.deepEqual(ids(pathSortsFor(false, true)), [], "off: a supporter has no 추천 순서");
  assert.deepEqual(ids(pathSortsFor(true, true)), ["KRAKEN"], "on: a supporter's only rule is the score");
});

test("the score's name follows the answer's own role (krakenScoreRole), else the web's position check", () => {
  assert.equal(scoredAsSupporter("SUPPORT", false), true);
  assert.equal(scoredAsSupporter("DEALER", true), false);
  // A value the web does not know yet (the field's values may grow) or none: the web's own check.
  for (const role of [null, undefined, "HEALER"]) {
    assert.equal(scoredAsSupporter(role, true), true);
    assert.equal(scoredAsSupporter(role, false), false);
  }
  const answer = { sort: "KRAKEN", combatPower: 1, finalCombatPower: null, krakenScore: 1, finalKrakenScore: 2 };
  assert.equal(pathFigures({ ...answer, krakenScoreRole: "SUPPORT" }, false).name, "서포터 점수");
  assert.equal(pathFigures({ ...answer, krakenScoreRole: "DEALER" }, true).name, "크라켄 점수");
  assert.equal(pathFigures({ ...answer, krakenScoreRole: null }, true).name, "서포터 점수");
});

test("the api's own supporter KRAKEN path (api #969 test answer) passes the contract and reads in its score", async () => {
  const real = JSON.parse(
    readFileSync(new URL("./spec-up-fixtures/character-spec-up-path-kraken-supporter.json", import.meta.url), "utf8"),
  );
  const result = await requestSpecUpPath("점수순서서폿", "KRAKEN", origin, {
    fetcher: async (url) => {
      assert.match(String(url), /sort=KRAKEN$/);
      return json(real);
    },
  });
  assert.ok(result.ok);
  const path = result.envelope.data;
  assert.equal(path.finalCombatPower, null);
  const figures = pathFigures(path, true);
  assert.deepEqual([figures.name, figures.start, figures.final], ["서포터 점수", 5286.48, 5490.12]);
  assert.deepEqual(
    path.steps.map((step) => stepFigures(step, true).gain),
    [53.33, 40.57, 43.43, 41.33, 24.99],
  );
  assert.ok(path.steps.every((step) => stepFigures(step, false).gain === null), "no combat power on any step");
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

test("a supporter's KRAKEN path (api #967): null combat power passes the contract and is told in the score", async () => {
  // As api #967 answers a supporter: combat power null on the path and its steps, the score given.
  const kraken = structuredClone(sample);
  Object.assign(kraken.data, { sort: "KRAKEN", finalCombatPower: null, krakenScore: 100, finalKrakenScore: 112.5 });
  kraken.data.steps.forEach((step: Record<string, unknown>, i: number) =>
    Object.assign(step, {
      deltaCombatPower: null,
      combatPowerAfter: null,
      combatPowerPer10kGold: null,
      deltaKrakenScore: 6.25,
      krakenScoreAfter: 100 + 6.25 * (i + 1),
      krakenScorePer100kGold: i === 0 ? 10.42 : null,
    }),
  );
  const result = await requestSpecUpPath("스펙순서", "EFFICIENCY", origin, { fetcher: async () => json(kraken) });
  assert.ok(result.ok, "the contract takes a null step combat power");
  const path = result.envelope.data;

  const figures = pathFigures(path, true);
  assert.deepEqual(figures, { scored: true, name: "서포터 점수", perGold: "10만G당 점수", start: 100, final: 112.5 });
  assert.equal(pathFigures(path, false).name, "크라켄 점수");
  assert.deepEqual(
    path.steps.map((step) => stepFigures(step, true)),
    [
      { gain: 6.25, after: 106.25, perGold: 10.42 },
      { gain: 6.25, after: 112.5, perGold: null },
    ],
  );
  // No combat power is ever read from it: the CP figures are null.
  assert.deepEqual(stepFigures(path.steps[0], false), { gain: null, after: null, perGold: null });

  // Any other answer is told in combat power, as before; an older answer without the score fields too.
  const plain = (await requestSpecUpPath("스펙순서", "DELTA", origin, { fetcher: async () => json(sample) })) as {
    ok: true;
    envelope: { data: typeof path };
  };
  const cp = pathFigures(plain.envelope.data, false);
  assert.deepEqual([cp.scored, cp.name, cp.perGold, cp.final], [false, "전투력", "1만G당 전투력", sample.data.finalCombatPower]);
  assert.equal(stepFigures(plain.envelope.data.steps[0], false).gain, sample.data.steps[0].deltaCombatPower);
  assert.equal(stepFigures(plain.envelope.data.steps[0], true).gain, null, "no score fields → null, never 0");
});

test("SPEC_UP_PATH: on/off override, hidden only on production, and never without the guide", () => {
  const prod = "https://loakraken.gg";
  assert.equal(isSpecUpPathEnabled({}), true);
  assert.equal(isSpecUpPathEnabled({ SITE_URL: prod }), false);
  assert.equal(isSpecUpPathEnabled({ SITE_URL: prod, SPEC_UP_GUIDE: "on", SPEC_UP_PATH: "on" }), true);
  assert.equal(isSpecUpPathEnabled({ SPEC_UP_PATH: "off" }), false);
  assert.equal(isSpecUpPathEnabled({ SPEC_UP_GUIDE: "off", SPEC_UP_PATH: "on" }), false);
});
