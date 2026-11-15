import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseTarget, simulatorPath, stepCost, stepKindLabel, targetError, type GoalStep } from "../lib/spec-up/goal";
import { editsFor, gearTypeOf, koreanGold, readTry, readTryPath, tryPathParam } from "../lib/spec-up/model";
import { NO_EDITS, toChanges, type Edits } from "../lib/combat-power/model";
import { requestSpecUpGoal } from "../lib/spec-up/upstream";

const sample = JSON.parse(readFileSync(new URL("./spec-up-fixtures/character-spec-up-goal.json", import.meta.url), "utf8"));
const origin = "http://backend.test";
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

test("the backend sample passes the contract and reaches the target in three simulator steps", async () => {
  const result = await requestSpecUpGoal("목캐릭터", "3100", origin, {
    fetcher: async (url) => {
      assert.match(String(url), /\/api\/v1\/characters\/spec-up\/goal\?characterName=.+&targetCombatPower=3100$/);
      return json(sample);
    },
  });
  assert.ok(result.ok);
  const goal = result.envelope.data;
  assert.equal(goal.reached, true);
  assert.equal(goal.steps.length, 3);
  // v1 answer (before api #592): same gem slot twice (8→9→10), the second step
  // priced as the step up. The v2 answer is checked below.
  assert.deepEqual(
    goal.steps.map((s) => [s.kind, s.from, s.to, s.cost.code]),
    [
      ["GEM_LEVEL", "8레벨", "9레벨", "GEM_UPGRADE"],
      ["GEM_LEVEL", "9레벨", "10레벨", "GEM_STEP"],
      ["EQUIPMENT_QUALITY", "품질 90", "품질 100", "QUALITY_COST_UNCONFIRMED"],
    ],
  );
});

test("targets the backend would refuse never leave the proxy; its 400 and 404 codes pass through", async () => {
  for (const target of [null, "", "0", "-5", "12.345", "abc"])
    assert.deepEqual(await requestSpecUpGoal("목캐릭터", target, origin, { fetcher: async () => json(sample) }), {
      ok: false,
      error: { code: "INVALID_REQUEST", status: 400 },
    });
  const range = await requestSpecUpGoal("목캐릭터", "99999", origin, {
    fetcher: async () => json({ code: "SPEC_UP_GOAL_OUT_OF_RANGE", message: "", data: null }, 400),
  });
  assert.ok(!range.ok && range.error.code === "SPEC_UP_GOAL_OUT_OF_RANGE");
  const notCached = await requestSpecUpGoal("목캐릭터", "3100", origin, {
    fetcher: async () => json({ code: "CHARACTER_NOT_CACHED", message: "", data: null }, 404),
  });
  assert.ok(!notCached.ok && notCached.error.code === "CHARACTER_NOT_CACHED");
  const limited = await requestSpecUpGoal("목캐릭터", "3100", origin, {
    fetcher: async () => json({ code: "CLIENT_RATE_LIMITED", message: "", data: null }, 429, { "Retry-After": "10" }),
  });
  assert.ok(!limited.ok && limited.error.code === "LOST_ARK_RATE_LIMITED" && limited.error.retryAt);
  // api #922: every computing seat taken keeps its own code and Retry-After, as on the path.
  const busy = await requestSpecUpGoal("목캐릭터", "3100", origin, {
    fetcher: async () => json({ code: "SPEC_UP_BUSY", message: "", data: null }, 429, { "Retry-After": "2" }),
  });
  assert.ok(!busy.ok && busy.error.code === "SPEC_UP_BUSY" && busy.error.status === 429 && busy.error.retryAt);
});

test("target input follows the backend rule: above 0, two decimals, at most twice today", () => {
  assert.equal(parseTarget("12,360"), 12360);
  assert.equal(parseTarget("12360.5"), 12360.5);
  assert.equal(parseTarget(""), null);
  assert.ok(Number.isNaN(parseTarget("12.345")!));
  assert.equal(targetError(24000, 12000), null);
  assert.equal(targetError(24000.01, 12000), "목표는 지금 전투력의 2배까지 넣을 수 있어요.");
  assert.equal(targetError(Number.NaN, 12000), "숫자만 입력해 주세요(소수 둘째 자리까지).");
});

test("a step kind without a label reads 기타 단계; 계승 has its own (PM-프론트 10-12)", () => {
  assert.equal(stepKindLabel("GEM_LEVEL"), "보석");
  assert.equal(stepKindLabel("EQUIPMENT_SUCCESSION"), "계승");
  // The path's own kind names: 상급 재련 (was 기타 단계), 완갑 (api #809), 스톤 (api #812).
  assert.equal(stepKindLabel("EQUIPMENT_ADVANCED_REFINE"), "상급 재련");
  assert.equal(stepKindLabel("ARM_GUARD"), "완갑");
  assert.equal(stepKindLabel("ABILITY_STONE"), "어빌리티 스톤");
  assert.equal(stepKindLabel("SOMETHING_NEW"), "기타 단계");
});

test("costs: gold when known, 시세 준비 중 when pending, 비용 미확인 otherwise", () => {
  const [gem, , quality] = sample.data.steps as GoalStep[];
  assert.equal(stepCost(gem, koreanGold), "62만G");
  assert.equal(stepCost({ ...gem, cost: { ...gem.cost, status: "PENDING", amount: null } }, koreanGold), "시세 준비 중");
  assert.equal(stepCost(quality, koreanGold), "비용 미확인");
  // api #592 (spec-up-goal-v2): a gem step costs from now to that level, said so.
  assert.equal(stepCost(gem, koreanGold, "spec-up-goal-v2"), "지금부터 62만G");
  assert.equal(stepCost(gem, koreanGold, "spec-up-goal-v1"), "62만G");
  assert.equal(stepCost(quality, koreanGold, "spec-up-goal-v2"), "비용 미확인");
  // PM-프론트 10-18: an OK cost of 0 is "추가 비용 없음", in either rule version.
  const free = { ...gem, cost: { ...gem.cost, amount: 0 } };
  assert.equal(stepCost(free, koreanGold, "spec-up-goal-v2"), "추가 비용 없음");
  assert.equal(stepCost(free, koreanGold), "추가 비용 없음");
});

test("지금부터 holds for every rule version from v2 on (api #894 v3, v4 next); unknown names keep the plain cost", () => {
  const [gem, , quality] = sample.data.steps as GoalStep[];
  // Gem steps cost from now since v2; later versions change other rules, not this one.
  for (const version of ["spec-up-goal-v2", "spec-up-goal-v3", "spec-up-goal-v4", "spec-up-goal-v10"])
    assert.equal(stepCost(gem, koreanGold, version), "지금부터 62만G", version);
  // Before v2, no version, or a name we cannot read: today's plain cost.
  for (const version of ["spec-up-goal-v1", "spec-up-goal-v0", null, undefined, "", "spec-up-goal-v", "spec-up-goal-vX", "spec-up-goal-v3-beta", "other-v3", " spec-up-goal-v3"])
    assert.equal(stepCost(gem, koreanGold, version), "62만G", String(version));
  // Only gem steps say it, in any version.
  assert.equal(stepCost(quality, koreanGold, "spec-up-goal-v3"), "비용 미확인");
});

test("시뮬레이터에서 열기 carries only the changes the simulator takes, and counts the rest", () => {
  const steps = sample.data.steps as GoalStep[];
  const refine = { ...steps[0], kind: "EQUIPMENT_REFINE", change: { ...steps[0].change, kind: "EQUIPMENT_REFINE", refine: 21 } };
  const path = simulatorPath([...steps, refine]);
  assert.equal(path.changes.length, 3);
  assert.equal(path.skipped, 1);
  // The path round-trips through ?try=, and a single change still reads (적용해 보기).
  assert.deepEqual(readTryPath(tryPathParam(path.changes)), path.changes);
  assert.deepEqual(readTryPath(JSON.stringify(path.changes[0])), [path.changes[0]]);
  assert.equal(readTry(JSON.stringify(path.changes[0]))?.level, 9);
  assert.deepEqual(readTryPath("{"), []);
});

test("시뮬레이터에서 열기 carries a weapon refine step and skips an armour one (#1567, api #884)", () => {
  const [gem] = sample.data.steps as GoalStep[];
  const refineStep = (index: number, refine: number) =>
    ({
      ...gem,
      kind: "EQUIPMENT_REFINE",
      candidateId: `EQUIPMENT_REFINE:${index}:${refine}`,
      change: { ...gem.change, kind: "EQUIPMENT_REFINE", slot: null, level: null, index, refine },
    }) as GoalStep;
  const gearType = gearTypeOf({ loadout: { equipment: [{ type: "무기" }, { type: "투구" }] } } as never);
  const path = simulatorPath([gem, refineStep(0, 21), refineStep(1, 20), refineStep(0, 22)], gearType);
  assert.deepEqual(
    path.changes.map((c) => [c.kind, c.index ?? c.slot, c.level ?? c.refine]),
    [
      ["GEM_LEVEL", 0, 9],
      ["EQUIPMENT_REFINE", 0, 21],
      ["EQUIPMENT_REFINE", 0, 22],
    ],
  );
  assert.equal(path.skipped, 1);
  // Without the character the slot is unknown: every refine step stays out.
  assert.equal(simulatorPath([gem, refineStep(0, 21)]).skipped, 1);
});

test("a stone step (api #812) opens with both engravings; a step is never opened half", () => {
  const [gem] = sample.data.steps as GoalStep[];
  const engraving = (name: string, level: number) => ({ ...gem.change, kind: "STONE_ENGRAVING", slot: null, level, name });
  const stone = {
    ...gem,
    kind: "ABILITY_STONE",
    candidateId: "ABILITY_STONE:0:7-6",
    change: engraving("원한", 7),
    changes: [engraving("원한", 7), engraving("예리한 둔기", 6)],
  } as GoalStep;
  const path = simulatorPath([gem, stone]);
  assert.deepEqual(
    path.changes.map((c) => [c.kind, c.name ?? c.slot, c.level]),
    [
      ["GEM_LEVEL", 0, 9],
      ["STONE_ENGRAVING", "원한", 7],
      ["STONE_ENGRAVING", "예리한 둔기", 6],
    ],
  );
  assert.equal(path.skipped, 0);
  // One change the simulator cannot take: the whole step stays out and is counted.
  const mixed = { ...stone, changes: [engraving("원한", 7), { ...gem.change, kind: "EQUIPMENT_REFINE", refine: 21 }] } as GoalStep;
  const half = simulatorPath([gem, mixed]);
  assert.equal(half.changes.length, 1);
  assert.equal(half.skipped, 1);
  // Today's api (no `changes`): the one `change` as before.
  assert.equal(simulatorPath([{ ...stone, changes: undefined }]).changes.length, 1);
});

test("a 연마 step (api #951) opens whole, NONE lines too, and the last step per accessory wins", () => {
  const [gem] = sample.data.steps as GoalStep[];
  const line = (index: number, n: number, option: string, grade: string | null) => ({
    ...gem.change,
    kind: "POLISH",
    slot: null,
    level: null,
    index,
    line: n,
    option,
    grade,
  });
  const polish = (id: string, changes: ReturnType<typeof line>[]) =>
    ({ ...gem, kind: "POLISH", candidateId: id, change: changes[0], changes }) as GoalStep;
  // The api's order: named options first, then the line with no scoring option (NONE, grade null).
  const first = polish("POLISH:7:HM", [line(7, 0, "추가 피해 %", "HIGH"), line(7, 1, "적에게 주는 피해 %", "MID"), line(7, 2, "NONE", null)]);
  const ring = polish("POLISH:9:HH", [line(9, 1, "치명타 피해 %", "HIGH")]);
  // A later step on the same accessory: each line it names replaces that line in its place (path order kept),
  // a line it does not name keeps the earlier step's (here the NONE line).
  const later = polish("POLISH:7:HH", [line(7, 0, "추가 피해 %", "HIGH"), line(7, 1, "적에게 주는 피해 %", "HIGH")]);
  const path = simulatorPath([gem, first, ring, later]);
  assert.equal(path.skipped, 0);
  assert.deepEqual(
    path.changes.map((c) => [c.kind, c.index ?? c.slot, c.line ?? null, c.option ?? null, c.grade ?? null]),
    [
      ["GEM_LEVEL", 0, null, null, null],
      ["POLISH", 7, 0, "추가 피해 %", "HIGH"],
      ["POLISH", 7, 1, "적에게 주는 피해 %", "HIGH"],
      ["POLISH", 7, 2, "NONE", null],
      ["POLISH", 9, 1, "치명타 피해 %", "HIGH"],
    ],
  );
  // Without the later step the NONE line goes in as it is, and the whole path survives ?try=.
  const opened = simulatorPath([first]).changes;
  assert.deepEqual(opened.map((c) => [c.line, c.option, c.grade]), [[0, "추가 피해 %", "HIGH"], [1, "적에게 주는 피해 %", "MID"], [2, "NONE", null]]);
  assert.deepEqual(
    readTryPath(tryPathParam(opened)).map((c) => [c.kind, c.index, c.line, c.option, c.grade ?? null]),
    [["POLISH", 7, 0, "추가 피해 %", "HIGH"], ["POLISH", 7, 1, "적에게 주는 피해 %", "MID"], ["POLISH", 7, 2, "NONE", null]],
  );
  // One line the simulator cannot take (no grade on a named option): the whole step stays out.
  assert.deepEqual(simulatorPath([polish("POLISH:7:X", [line(7, 0, "추가 피해 %", null), line(7, 2, "NONE", null)])]), { changes: [], skipped: 1 });
});

test("연마 chain MM → LH → MH on one accessory (api #951): per line, later wins, in either changes form", () => {
  const [gem] = sample.data.steps as GoalStep[];
  const line = (n: number, option: string, grade: string | null) => ({
    ...gem.change,
    kind: "POLISH",
    slot: null,
    level: null,
    index: 7,
    line: n,
    option,
    grade,
  });
  const step = (id: string, changes: ReturnType<typeof line>[]) =>
    ({ ...gem, kind: "POLISH", candidateId: id, change: changes[0], changes }) as GoalStep;
  // The 귀걸이 worn: 적에게 주는 피해 하, 추가 피해 중, flat 공격력 중 (the line each step drops: NONE).
  const worn = {
    gems: [],
    gear: [],
    polish: [
      { index: 7, line: 0, option: "적에게 주는 피해", grade: "LOW" as const, value: "+0.55%" },
      { index: 7, line: 1, option: "추가 피해", grade: "MID" as const, value: "+1.60%" },
      { index: 7, line: 2, option: "공격력", grade: "MID" as const, value: "+195" },
    ],
  };
  // What /simulate gets from the opened path: the changes fold into one state per line, then toChanges.
  const sent = (steps: GoalStep[]) =>
    toChanges(
      simulatorPath(steps).changes.reduce<Edits>((edits, change) => editsFor(change, edits) ?? edits, NO_EDITS),
      worn,
    );
  const mm = step("POLISH:7:MM", [line(0, "추가 피해 %", "MID"), line(1, "적에게 주는 피해 %", "MID"), line(2, "NONE", null)]);
  // SUPERSET (the form #951 sends, PM 총괄 11-15): every line that differs from the worn accessory.
  const lh = step("POLISH:7:LH", [line(0, "추가 피해 %", "LOW"), line(1, "적에게 주는 피해 %", "HIGH"), line(2, "NONE", null)]);
  const mh = step("POLISH:7:MH", [line(0, "추가 피해 %", "MID"), line(1, "적에게 주는 피해 %", "HIGH"), line(2, "NONE", null)]);
  const final = [
    { kind: "POLISH", index: 7, line: 0, option: "추가 피해 %", grade: "MID" },
    { kind: "POLISH", index: 7, line: 1, option: "적에게 주는 피해 %", grade: "HIGH" },
    { kind: "POLISH", index: 7, line: 2, option: "NONE" },
  ];
  assert.deepEqual(sent([mm, lh, mh]), final);
  // Diff form (only what changes from the step before): MH names line 0 alone, and lines 1 and 2 keep LH's
  // (review P1 #1700: replacing the whole accessory lost them).
  const mhDiff = step("POLISH:7:MH-diff", [line(0, "추가 피해 %", "MID")]);
  assert.deepEqual(sent([mm, lh, mhDiff]), final);
  // A step that keeps the worn flat line sends a reset line back to it: that line goes out as worn (nothing).
  const keep = step("POLISH:7:HH", [line(0, "추가 피해 %", "HIGH"), line(1, "적에게 주는 피해 %", "HIGH"), line(2, "공격력", "MID")]);
  assert.deepEqual(sent([mm, lh, keep]), [
    { kind: "POLISH", index: 7, line: 0, option: "추가 피해 %", grade: "HIGH" },
    { kind: "POLISH", index: 7, line: 1, option: "적에게 주는 피해 %", grade: "HIGH" },
  ]);
  // And a later step can drop that line again (NONE after the reset).
  assert.deepEqual(sent([mm, keep, mh]), final);
});

test("목표 경로 v2 응답(api #592): 보석 단계 비용은 지금부터 그 레벨까지, GEM_STEP 없음, 합계는 단계를 더한 값이 아님", () => {
  const goal = JSON.parse(readFileSync(new URL("./spec-up-fixtures/character-spec-up-goal-v2.json", import.meta.url), "utf8")).data;
  assert.equal(goal.ruleVersion, "spec-up-goal-v2");
  assert.ok(goal.steps.every((s: GoalStep) => s.cost.code !== "GEM_STEP"));
  assert.deepEqual(
    goal.steps.map((s: GoalStep) => stepCost(s, koreanGold, goal.ruleVersion)),
    ["지금부터 60만G", "지금부터 260만G", "비용 미확인"],
  );
  // 260만 is the 8→10 cost from now, not 60만 + 200만 added up by the screen.
  assert.equal(goal.steps[1].cumulativeCost, 2_600_000);
});
