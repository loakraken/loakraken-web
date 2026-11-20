import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { GoalStep } from "../lib/spec-up/goal";
import { extraCosts, isPathSort, pathCostNote, pathCpStopNote, pathFigures, pathScopeNote, pathSortsFor, pathTotal, scoredAsSupporter, stepFigures } from "../lib/spec-up/path";
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

test("computing seat busy (api #989): asked again after Retry-After, three times, only for SPEC_UP_BUSY", async () => {
  const { SpecUpQueryError, SEAT_RETRIES, seatRetry, seatRetryDelay } = await import("../lib/spec-up/client");
  const busy = new SpecUpQueryError({ code: "SPEC_UP_BUSY", status: 429, retryAt: 10_000 + 2_000 });
  assert.equal(SEAT_RETRIES, 3);
  assert.deepEqual([0, 1, 2, 3].map((n) => seatRetry(n, busy)), [true, true, true, false]);
  // Other failures are shown as they come: the rate limit, a timeout, a plain error.
  assert.equal(seatRetry(0, new SpecUpQueryError({ code: "RATE_LIMITED", status: 429, retryAt: 12_000 })), false);
  assert.equal(seatRetry(0, new SpecUpQueryError({ code: "LOST_ARK_API_ERROR", status: 502 })), false);
  assert.equal(seatRetry(0, new Error("x")), false);
  // The wait is the Retry-After, held to 0.5–5 s; none given reads as 1 s.
  assert.equal(seatRetryDelay(0, busy, 10_000), 2_000);
  assert.equal(seatRetryDelay(0, new SpecUpQueryError({ code: "SPEC_UP_BUSY", status: 429, retryAt: 10_000 + 60_000 }), 10_000), 5_000);
  assert.equal(seatRetryDelay(0, new SpecUpQueryError({ code: "SPEC_UP_BUSY", status: 429, retryAt: 10_000 }), 10_000), 500);
  assert.equal(seatRetryDelay(0, new SpecUpQueryError({ code: "SPEC_UP_BUSY", status: 429 }), 10_000), 1_000);
});

test("the total line (api #993): known gold plus unknown steps; an older api's null total stays unknown", () => {
  const base = sample.data;
  // A priced path: its total as it is.
  assert.deepEqual(pathTotal(base), { gold: 2_600_000, unknownSteps: 0 });
  // #993: totalCost null with the known part beside it.
  assert.deepEqual(pathTotal({ ...base, totalCost: null, knownCostTotal: 2_600_000, unknownCostSteps: 1 }), { gold: 2_600_000, unknownSteps: 1 });
  // PM 총괄 11-19: every step unknown → no gold (미정), only the count; never 0G.
  assert.equal(base.steps.length, 2);
  assert.deepEqual(pathTotal({ ...base, totalCost: null, knownCostTotal: 0, unknownCostSteps: 2 }), { gold: null, unknownSteps: 2 });
  // A known step that costs nothing more plus an unknown one: 0G + the count (a cost is known).
  assert.deepEqual(pathTotal({ ...base, totalCost: null, knownCostTotal: 0, unknownCostSteps: 1 }), { gold: 0, unknownSteps: 1 });
  // Only free steps: the api's own total, 0G.
  assert.deepEqual(pathTotal({ ...base, totalCost: 0 }), { gold: 0, unknownSteps: 0 });
  // An api before #993 (fields absent or null): no total, as today.
  assert.deepEqual(pathTotal({ ...base, totalCost: null }), { gold: null, unknownSteps: 0 });
  assert.deepEqual(pathTotal({ ...base, totalCost: null, knownCostTotal: null, unknownCostSteps: null }), { gold: null, unknownSteps: 0 });
  // Half an answer or a value that cannot be a count: never a made-up total.
  assert.deepEqual(pathTotal({ ...base, totalCost: null, knownCostTotal: 2_600_000 }), { gold: null, unknownSteps: 0 });
  assert.deepEqual(pathTotal({ ...base, totalCost: null, knownCostTotal: 2_600_000, unknownCostSteps: 0 }), { gold: null, unknownSteps: 0 });
  assert.deepEqual(pathTotal({ ...base, totalCost: null, knownCostTotal: -1, unknownCostSteps: 1 }), { gold: null, unknownSteps: 0 });
  assert.deepEqual(pathTotal({ ...base, totalCost: null, knownCostTotal: 2_600_000, unknownCostSteps: 1.5 }), { gold: null, unknownSteps: 0 });
  // A known total wins over the fields.
  assert.deepEqual(pathTotal({ ...base, knownCostTotal: 1, unknownCostSteps: 1 }), { gold: 2_600_000, unknownSteps: 0 });
});

test("the backend's #993 sample (SpecUpIntegrationTest, api develop 7f9aff63) passes the contract and reads as 260만G + 비용 모름 1단계", async () => {
  const v6 = JSON.parse(readFileSync(new URL("./spec-up-fixtures/character-spec-up-path-v6.json", import.meta.url), "utf8"));
  const result = await requestSpecUpPath("스펙순서", "EFFICIENCY", origin, { fetcher: async () => json(v6) });
  assert.ok(result.ok);
  const path = result.envelope.data;
  assert.equal(path.ruleVersion, "spec-up-path-v6");
  // EFFICIENCY takes the unknown-cost step at the end and sends no unpriced list (api #993).
  assert.deepEqual(
    path.steps.map((s) => [s.order, s.kind, s.cost.status, s.cumulativeCost, s.extraCost]),
    [
      [1, "GEM_LEVEL", "OK", 600_000, 600_000],
      [2, "GEM_LEVEL", "OK", 2_600_000, 2_000_000],
      [3, "EQUIPMENT_QUALITY", "UNKNOWN", null, null],
    ],
  );
  assert.deepEqual(path.unpriced, []);
  assert.equal(path.totalCost, null);
  assert.deepEqual([path.knownCostTotal, path.unknownCostSteps], [2_600_000, 1]);
  assert.deepEqual(pathTotal(path), { gold: 2_600_000, unknownSteps: 1 });
  // The step costs the row shows: the api's extraCost, null for the unknown one ('비용 모름').
  assert.deepEqual(extraCosts(path.steps), [600_000, 2_000_000, null]);
});

test("the cost note follows the order's rule on spec-up-path-v6 and v7 only (api #993 paidCost / marginal, #1019 jumps)", () => {
  const gem = { kind: "GEM_LEVEL" } as GoalStep;
  const polish = { kind: "POLISH" } as GoalStep;
  const note = (sort: string, ruleVersion = "spec-up-path-v6", steps = [gem]) => pathCostNote({ sort, ruleVersion, steps });
  // 효율 우선 and 점수 효율 (paidCost): a bound gem (and an empty slot's, an untradeable accessory, a stone) pays its
  // whole new price each step; only a tradeable one takes the step before off.
  const perStep =
    "비용은 그 단계에서 더 드는 골드예요. 거래할 수 있는 보석·장신구는 같은 칸의 앞 단계 값을 빼고, 귀속 보석·빈 칸 보석·거래할 수 없는 장신구·어빌리티 스톤은 단계마다 새 값을 다 셌어요.";
  assert.equal(note("EFFICIENCY"), perStep);
  assert.equal(note("KRAKEN"), perStep);
  // 전투력 우선 (marginal): a gem, an ability stone and an accessory (polish) step take the same slot's step before
  // off; accessories only when the answer has a polish step.
  assert.equal(note("DELTA"), "비용은 그 단계에서 더 드는 골드이고, 보석·어빌리티 스톤은 같은 칸의 앞 단계 비용을 빼고 셌어요.");
  assert.equal(
    note("DELTA", undefined, [gem, polish]),
    "비용은 그 단계에서 더 드는 골드이고, 보석·어빌리티 스톤·장신구는 같은 칸의 앞 단계 비용을 빼고 셌어요.",
  );
  // v7 (api #1019 level jumps): the same rules, and a 효율 우선 or 점수 효율 step may raise several levels at once,
  // its cost the whole range; 전투력 우선 stays one level per step.
  const jumps = `${perStep} 한 단계에 여러 레벨을 올리면 그 레벨까지 드는 비용을 한 번에 셌어요.`;
  assert.equal(note("EFFICIENCY", "spec-up-path-v7"), jumps);
  assert.equal(note("KRAKEN", "spec-up-path-v7"), jumps);
  assert.equal(note("DELTA", "spec-up-path-v7"), note("DELTA"));
  assert.equal(note("DELTA", "spec-up-path-v7", [gem, polish]), note("DELTA", undefined, [gem, polish]));
  // Another rule version (before v6 the orders counted differently, after v7 nobody has checked) or an order the
  // web does not know: only what a step cost means, no claim on how it was counted.
  const plain = "비용은 그 단계에서 더 드는 골드예요.";
  for (const [sort, version] of [
    ["EFFICIENCY", "spec-up-path-v5"],
    ["KRAKEN", "spec-up-path-v1"],
    ["DELTA", "spec-up-path-v5"],
    ["EFFICIENCY", "spec-up-path-v8"],
    ["DELTA", "spec-up-path-v8"],
    ["COST", "spec-up-path-v6"],
    ["COST", "spec-up-path-v7"],
  ])
    assert.equal(note(sort, version, [gem, polish]), plain, `${sort} ${version}`);
});

test("the backend's #1029 sample (dealer KRAKEN, arm guard at step 2) passes the contract and stops combat power at step 2", async () => {
  const sample = JSON.parse(readFileSync(new URL("./spec-up-fixtures/character-spec-up-path-kraken-armor.json", import.meta.url), "utf8"));
  const result = await requestSpecUpPath("점수순서", "KRAKEN", origin, { fetcher: async () => json(sample) });
  assert.ok(result.ok);
  const path = result.envelope.data;
  assert.deepEqual([path.sort, path.combatPowerStopOrder, path.combatPowerStopReasonCode, path.finalCombatPower], ["KRAKEN", 2, "ARMOR_REFINE_CP_UNCONFIRMED", null]);
  // Step 1 keeps its combat power; from step 2 on (the arm guard) it is left out, the score stays.
  assert.deepEqual(
    path.steps.slice(0, 3).map((s) => [s.order, s.kind, s.deltaCombatPower != null, s.deltaKrakenScore != null]),
    [
      [1, "GEM_LEVEL", true, true],
      [2, "ARM_GUARD", false, true],
      [3, "GEM_LEVEL", false, true],
    ],
  );
  assert.equal(
    pathCpStopNote(path),
    "2단계부터는 전투력을 계산하지 않았어요. 방어구·팔 보호구 재련은 전투력 계산식을 아직 확인하고 있어요. 점수와 비용은 그대로 셌어요.",
  );
});

test("the combat-power stop note: where, why only for a known code, none without a stop (api #1029)", () => {
  const steps = [{ order: 1 }, { order: 2 }, { order: 3 }] as GoalStep[];
  const note = (combatPowerStopOrder: unknown, combatPowerStopReasonCode: unknown = "ARMOR_REFINE_CP_UNCONFIRMED") =>
    pathCpStopNote({ steps, combatPowerStopOrder, combatPowerStopReasonCode } as Parameters<typeof pathCpStopNote>[0]);
  const why = " 방어구·팔 보호구 재련은 전투력 계산식을 아직 확인하고 있어요. 점수와 비용은 그대로 셌어요.";
  assert.equal(note(1), `이 순서는 첫 단계부터 전투력을 계산하지 않았어요.${why}`);
  assert.equal(note(3), `3단계부터는 전투력을 계산하지 않았어요.${why}`);
  // A code the web does not know: where only, no reason it cannot vouch for.
  assert.equal(note(2, "SOMETHING_NEW"), "2단계부터는 전투력을 계산하지 않았어요.");
  assert.equal(note(2, null), "2단계부터는 전투력을 계산하지 않았어요.");
  // A code that names an Object.prototype member is not a reason (codex #1835 P3: it read '[object Object]').
  for (const code of ["__proto__", "toString", "constructor", "hasOwnProperty"])
    assert.equal(note(2, code), "2단계부터는 전투력을 계산하지 않았어요.", code);
  // No stop (null, an api before #1029) or a step the path does not have: no note.
  for (const order of [null, undefined, 0, 4, 1.5, "2"]) assert.equal(note(order), null, String(order));
});
test("pathScopeNote: 장신구 연마 · 깨달음 카르마 follow the answer's switch fields; missing is false (PM 총괄 11-21)", () => {
  const steps = (...kinds: string[]) => kinds.map((kind, i) => ({ order: i + 1, kind })) as GoalStep[];
  const note = (fields: Record<string, unknown>, ...kinds: string[]) =>
    pathScopeNote({ steps: steps(...kinds), ...fields } as Parameters<typeof pathScopeNote>[0]);
  const both = "이 순서는 장신구 연마·깨달음 카르마 단계도 다뤄요.";
  const off = "장신구 연마는 비용을 늘 잡을 수 있게 되면 더하고, 깨달음 카르마는 전투력 계산식이 없어 넣지 않아요.";
  assert.equal(note({ polishStepsConsidered: true, karmaStepsConsidered: true }, "POLISH", "KARMA_LEVEL"), both);
  // On with none picked: the field, not the steps.
  assert.equal(note({ polishStepsConsidered: true, karmaStepsConsidered: true }, "GEM_LEVEL"), both);
  assert.equal(
    note({ polishStepsConsidered: true, karmaStepsConsidered: false }, "POLISH"),
    "이 순서는 장신구 연마 단계도 다뤄요. 깨달음 카르마는 전투력 계산식이 없어 넣지 않아요.",
  );
  assert.equal(
    note({ polishStepsConsidered: false, karmaStepsConsidered: true }),
    "이 순서는 깨달음 카르마 단계도 다뤄요. 장신구 연마는 비용을 늘 잡을 수 있게 되면 더해요.",
  );
  // Production (both switches off), an api before the fields (missing) and anything but true: today's words, steps or not.
  assert.equal(note({ polishStepsConsidered: false, karmaStepsConsidered: false }), off);
  assert.equal(note({}, "POLISH", "KARMA_LEVEL"), off);
  assert.equal(note({ polishStepsConsidered: null, karmaStepsConsidered: null }, "POLISH"), off);
  assert.equal(note({ polishStepsConsidered: "true", karmaStepsConsidered: 1 }), off);
});