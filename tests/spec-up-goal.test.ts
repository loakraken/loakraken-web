import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseTarget, simulatorPath, stepCost, stepKindLabel, targetError, type GoalStep } from "../lib/spec-up/goal";
import { koreanGold, readTry, readTryPath, tryPathParam } from "../lib/spec-up/model";
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
