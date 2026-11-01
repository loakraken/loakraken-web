import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PARTS,
  costLines,
  defaultPart,
  gradeFromName,
  parsePlanRequest,
  partsFromCharacter,
  refiningFailureCopy,
  requestKey,
  stageGold,
  stageMaterials,
  summarize,
  targetItemLevel,
  toRequest,
  type PartId,
  type PartState,
  type Plan,
} from "../lib/refining/model";
import { isPlanEnvelope } from "../lib/refining/validate";
import { requestPlan } from "../lib/refining/upstream";
import type { Character } from "../lib/character/model";

const read = (path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const envelope = () => read("./refining-fixtures/refining-plan.json");
const origin = "http://127.0.0.1:8080";
const options = {
  weaponBreath: true,
  armorBreath: false,
  armGuardBreath: true,
  weaponBook: false,
  armorBook: true,
  growthSupport: true,
};

test("backend-generated refining fixture satisfies the contract", () => {
  assert.equal(isPlanEnvelope(envelope()), true);
  const broken = envelope();
  broken.data.stages[0].medianAttempts = "7";
  assert.equal(isPlanEnvelope(broken), false);
  const wrongCode = envelope();
  wrongCode.code = "SOMETHING_ELSE";
  assert.equal(isPlanEnvelope(wrongCode), false);
});

test("grade is read from the T4 equipment name", () => {
  assert.equal(gradeFromName("+25 운명의 전율 런처"), "JEONYUL");
  assert.equal(gradeFromName("+18 운명의 업화 모자"), "UPHWA");
  assert.equal(gradeFromName("+25 테스트 무기"), null);
  assert.equal(gradeFromName(null), null);
});

test("character equipment fills current stages and flags unreadable parts", () => {
  const data = read("./fixtures/character-full-data.json") as Character;
  data.loadout.equipment = [
    { type: "무기", name: "+25 운명의 전율 런처", detail: { refineLevel: 25 } },
    { type: "투구", name: "+20 운명의 업화 모자", detail: { refineLevel: 20 } },
    { type: "상의", name: "+9 운명의 업화 상의", detail: { refineLevel: 9 } },
    { type: "하의", name: "+19 테스트 하의", detail: { refineLevel: 19 } },
    { type: "장갑", name: "+21 운명의 전율 장갑", detail: null },
  ] as unknown as Character["loadout"]["equipment"];
  const { parts, unsupported } = partsFromCharacter(data);
  assert.deepEqual(parts.weapon, { ...defaultPart("JEONYUL"), current: 25, target: 25 });
  assert.equal(parts.helmet.current, 20);
  assert.equal(parts.helmet.grade, "UPHWA");
  assert.deepEqual(unsupported, ["상의", "하의", "장갑", "어깨"]);
  assert.equal(parts.chest.enabled, false, "unreadable parts start excluded");
  // No 완갑 on this character: left out quietly, not named as unreadable gear.
  assert.equal(parts.armGuard.enabled, false);
});

test("완갑 reads its stage from 0 with no grade in the name", () => {
  const data = read("./fixtures/character-full-data.json") as Character;
  data.loadout.equipment = [
    { type: "완갑", name: "+3 팔 보호구", detail: { refineLevel: 3 } },
  ] as unknown as Character["loadout"]["equipment"];
  const { parts, unsupported } = partsFromCharacter(data);
  assert.equal(parts.armGuard.enabled, true);
  assert.equal(parts.armGuard.current, 3);
  assert.equal(unsupported.includes("완갑"), false);
});

test("완갑 requests carry no grade, no book and no growth support, and its own breath", () => {
  const guard = PARTS.find((part) => part.type === "ARM_GUARD")!;
  const state: PartState = { ...defaultPart("JEONYUL"), current: 0, target: 3 };
  assert.deepEqual(toRequest(guard, state, options), {
    equipmentType: "ARM_GUARD",
    fromStage: 0,
    toStage: 3,
    useBreath: true,
    useBook: false,
    growthSupport: false,
    currentArtisanEnergy: 0,
  });
  assert.equal(toRequest(guard, state, { ...options, armGuardBreath: false })!.useBreath, false);
});

test("완갑 stages add no item level", () => {
  const parts = Object.fromEntries(
    PARTS.map((part) => [part.id, { ...defaultPart(), current: 18, target: 18 }]),
  ) as Record<PartId, PartState>;
  parts.armGuard = { ...defaultPart(), current: 0, target: 25 };
  assert.equal(targetItemLevel(1700, parts), 1700);
  parts.weapon = { ...parts.weapon, target: 19 };
  assert.equal(targetItemLevel(1700, parts), Math.round((1700 + 5 / 6) * 100) / 100);
});

test("a 완갑 answer (grade null) satisfies the contract", () => {
  const guard = envelope();
  guard.data.grade = null;
  guard.data.equipmentType = "ARM_GUARD";
  assert.equal(isPlanEnvelope(guard), true);
  // Response enums are tolerant (lib/tools/contract.ts); the type still holds.
  const numeric = envelope();
  numeric.data.grade = 1;
  assert.equal(isPlanEnvelope(numeric), false);
});

test("requests carry per-part options and skip parts without a goal", () => {
  const weapon = PARTS[0];
  const armor = PARTS[1];
  const part: PartState = { ...defaultPart("UPHWA"), current: 18, target: 21 };
  assert.equal(toRequest(weapon, { ...part, target: 18 }, options), null);
  assert.equal(toRequest(weapon, { ...part, enabled: false }, options), null);
  assert.deepEqual(toRequest(weapon, part, options), {
    grade: "UPHWA",
    equipmentType: "WEAPON",
    fromStage: 18,
    toStage: 21,
    useBreath: true,
    useBook: false,
    growthSupport: true,
    currentArtisanEnergy: 0,
  });
  const armorRequest = toRequest(armor, part, options)!;
  assert.equal(armorRequest.useBook, true);
  assert.equal(
    toRequest(armor, { ...part, grade: "JEONYUL" }, options)!.useBook,
    false,
    "books are 업화 only",
  );
  assert.equal(
    toRequest(armor, { ...part, current: 20, target: 22 }, options)!.useBook,
    false,
    "no book above 20",
  );
  assert.equal(requestKey(armorRequest), requestKey({ ...armorRequest }));
  assert.notEqual(
    requestKey(armorRequest),
    requestKey({ ...armorRequest, currentArtisanEnergy: 10 }),
  );
});

test("현재 성공 확률 goes out only when typed, and the failure count never", () => {
  const armor = PARTS[1];
  const part: PartState = { ...defaultPart("UPHWA"), current: 16, target: 18, artisanEnergy: 1.39 };
  const blank = toRequest(armor, part, options)!;
  assert.equal("currentSuccessRate" in blank, false);
  assert.equal("currentFailedAttempts" in blank, false);
  const typed = toRequest(armor, { ...part, successRate: 3.3 }, options)!;
  assert.equal(typed.currentSuccessRate, 3.3);
  assert.equal("currentFailedAttempts" in typed, false);
  assert.notEqual(requestKey(blank), requestKey(typed));
});

test("a rate that fits no failure count reads as its own message", () => {
  const copy = refiningFailureCopy({ code: "REFINING_SUCCESS_RATE_MISMATCH" });
  assert.equal(copy.title, "현재 성공 확률을 확인해 주세요");
  assert.match(copy.text, /숨결·책을 올리기 전/);
});

test("the answer's failure count and its origin pass the contract, and older answers without them too", () => {
  const derived = envelope();
  derived.data.failedAttemptsFrom = "SUCCESS_RATE";
  derived.data.stages[0].startFailedAttempts = 1;
  assert.equal(isPlanEnvelope(derived), true);
  const older = envelope();
  delete older.data.failedAttemptsFrom;
  for (const stage of older.data.stages) delete stage.startFailedAttempts;
  assert.equal(isPlanEnvelope(older), true);
});

test("plan requests are allow-listed before the backend", () => {
  const valid = { grade: "UPHWA", equipmentType: "ARMOR", fromStage: 18, toStage: 20 };
  assert.deepEqual(parsePlanRequest(valid), {
    ...valid,
    useBreath: false,
    useBook: false,
    growthSupport: false,
    currentArtisanEnergy: 0,
  });
  for (const bad of [
    null,
    [],
    { ...valid, grade: "ANCIENT" },
    { ...valid, fromStage: 9 },
    { ...valid, toStage: 26 },
    { ...valid, toStage: 18 },
    { ...valid, fromStage: 18.5 },
    { ...valid, useBreath: "yes" },
    { ...valid, currentArtisanEnergy: 101 },
    { ...valid, currentFailedAttempts: 11 },
    { ...valid, currentSuccessRate: 101 },
    { ...valid, currentSuccessRate: -1 },
    { ...valid, currentSuccessRate: 3.301 },
    { ...valid, currentSuccessRate: "3.3" },
  ])
    assert.equal(parsePlanRequest(bad), null, JSON.stringify(bad));
  // 현재 성공 확률 and the failure count pass on only when sent: a default count
  // would win over the rate at the api.
  assert.deepEqual(parsePlanRequest({ ...valid, currentSuccessRate: 3.3 })?.currentSuccessRate, 3.3);
  assert.equal("currentFailedAttempts" in parsePlanRequest(valid)!, false);
  assert.equal(parsePlanRequest({ ...valid, currentFailedAttempts: 2 })?.currentFailedAttempts, 2);
  assert.equal(
    "extra" in parsePlanRequest({ ...valid, extra: 1 })!,
    false,
    "unknown keys are dropped",
  );
  // 완갑: stages from 0, the grade is not passed on, book and growth support refused.
  const guard = { equipmentType: "ARM_GUARD", fromStage: 0, toStage: 1 };
  assert.deepEqual(parsePlanRequest({ ...guard, grade: "UPHWA" }), {
    ...guard,
    useBreath: false,
    useBook: false,
    growthSupport: false,
    currentArtisanEnergy: 0,
  });
  for (const bad of [
    { ...guard, fromStage: -1 },
    { ...guard, toStage: 0 },
    { ...guard, toStage: 26 },
    { ...guard, useBook: true },
    { ...guard, growthSupport: true },
    { ...valid, fromStage: 0 },
    { ...valid, grade: undefined },
  ])
    assert.equal(parsePlanRequest(bad), null, JSON.stringify(bad));
});

test("percentile modes scale each stage's worst case by its attempts", () => {
  const plan: Plan = envelope().data;
  const [stage] = plan.stages;
  assert.equal(stageMaterials(stage, "expected"), stage.expectedMaterials);
  assert.equal(stageGold(stage, "max"), stage.worstCaseGold);
  const median = stageMaterials(stage, "median");
  const perAttempt = stage.worstCaseMaterials[0].amount / stage.maxAttempts;
  assert.equal(median[0].amount, perAttempt * stage.medianAttempts);
  assert.equal(
    stageGold(stage, "p90"),
    (stage.worstCaseGold / stage.maxAttempts) * stage.p90Attempts,
  );
  // The backend's expected cost agrees with the per-attempt cost model
  // (expectedAttempts is rounded to two decimals).
  const modelled = perAttempt * stage.expectedAttempts;
  assert.ok(Math.abs(modelled / stage.expectedMaterials[0].amount - 1) < 0.001);
});

test("summary merges parts by material and rounds amounts up", () => {
  const plan: Plan = envelope().data;
  const twice = summarize(
    [
      { part: PARTS[1], plan },
      { part: PARTS[2], plan },
    ],
    "expected",
  );
  assert.equal(twice.stageCount, 4);
  const stone = twice.materials.find((m) => m.name === "운명의 수호석")!;
  const expected = plan.stages.reduce(
    (sum, s) => sum + s.expectedMaterials.find((m) => m.name === "운명의 수호석")!.amount,
    0,
  );
  assert.equal(stone.amount, Math.ceil(expected * 2));
  assert.equal(twice.gold, Math.ceil(plan.expectedGold * 2 - 1e-9));
  assert.equal(
    twice.attempts,
    plan.stages.reduce((sum, s) => sum + s.expectedAttempts, 0) * 2,
  );
  assert.deepEqual(
    twice.materials.map((m) => m.name),
    plan.expectedMaterials.map((m) => m.name),
    "first-seen order",
  );
  const max = summarize([{ part: PARTS[1], plan }], "max");
  assert.equal(max.gold, plan.worstCaseGold);
});

test("target item level averages five per stage across six parts", () => {
  const parts = Object.fromEntries(
    PARTS.map((p) => [p.id, { ...defaultPart(), current: 20, target: 20 }]),
  ) as Record<PartId, PartState>;
  parts.helmet.target = 23;
  parts.chest.target = 23;
  parts.pants.target = 23;
  parts.gloves = { ...parts.gloves, current: 21, target: 23 };
  parts.shoulder = { ...parts.shoulder, current: 21, target: 23 };
  assert.equal(targetItemLevel(1780.8333, parts), 1791.67);
  assert.equal(targetItemLevel(null, parts), null);
  parts.gloves.enabled = false;
  assert.equal(targetItemLevel(1780.8333, parts), 1790);
});

test("plan requests validate input and pass through allow-listed errors", async () => {
  let calls = 0;
  const fetcher = (async (url: URL, init: RequestInit) => {
    calls++;
    assert.equal(url.pathname, "/api/v1/refining/plans");
    assert.equal(init.method, "POST");
    assert.equal(JSON.parse(String(init.body)).fromStage, 18);
    return Response.json(envelope());
  }) as unknown as typeof fetch;
  const body = { grade: "UPHWA", equipmentType: "ARMOR", fromStage: 18, toStage: 20 };
  assert.equal((await requestPlan(body, origin, { fetcher })).ok, true);
  assert.equal((await requestPlan({ ...body, toStage: 30 }, origin, { fetcher })).ok, false);
  assert.equal(calls, 1);
  const rejected = await requestPlan(body, origin, {
    fetcher: (async () =>
      Response.json({ code: "INVALID_REQUEST" }, { status: 400 })) as typeof fetch,
  });
  assert.deepEqual(rejected.ok ? null : rejected.error, {
    code: "INVALID_REQUEST",
    status: 400,
  });
  const unconfigured = await requestPlan(body, undefined, { fetcher });
  assert.equal(unconfigured.ok ? null : unconfigured.error.code, "FRONTEND_API_NOT_CONFIGURED");
});

test("구매 골드 rounds up to listings, 소모 가치 is expected × unit price (#235)", () => {
  const prices = read("./market-fixtures/material-prices.json").data.items;
  const { lines, buyGold, valueRaw, unpriced } = costLines(
    [
      { name: "운명의 수호석", amount: 1000, expected: 999.4 },
      { name: "운명의 파편", amount: 30000 },
      { name: "없는 재료", amount: 5 },
      { name: "운명의 돌파석", amount: 10 },
    ],
    { "운명의 수호석": 400, "운명의 돌파석": 10 },
    prices,
  );
  assert.equal(lines[0].missing, 600);
  // 100개 묶음 31G: 600개 = 6묶음 186G, 남는 것 없음.
  assert.deepEqual(lines[0].purchase, { units: 6, perUnit: 100, gold: 186, leftover: 0 });
  // 파편 주머니(대) 3000개 232G: 30000개 = 10주머니 2320G.
  assert.deepEqual(lines[1].purchase, { units: 10, perUnit: 3000, gold: 2320, leftover: 0 });
  // 소모 가치는 보유량과 상관없이 기대 소모량 × 1개 단가(올림 전 값).
  assert.ok(Math.abs(lines[0].value! - 999.4 * 0.31) < 1e-9);
  assert.ok(Math.abs(lines[1].value! - 30000 * 0.077333) < 1e-6);
  assert.equal(lines[2].purchase, null);
  assert.deepEqual(lines[3].purchase?.gold, 0, "covered by inventory even without a price");
  assert.equal(lines[3].value, null);
  assert.equal(buyGold, 186 + 2320);
  assert.ok(Math.abs(valueRaw - (999.4 * 0.31 + 30000 * 0.077333)) < 1e-6, "unrounded, rounded once by the caller");
  assert.deepEqual(unpriced, ["없는 재료", "운명의 돌파석"]);
  // 601개면 7묶음, 99개 남음.
  const odd = costLines([{ name: "운명의 수호석", amount: 601 }], {}, prices).lines[0];
  assert.deepEqual(odd.purchase, { units: 7, perUnit: 100, gold: 217, leftover: 99 });
  assert.equal(costLines([{ name: "운명의 수호석", amount: 1 }], {}, null).unpriced.length, 1);
  // 묶음가가 없어도 1개 단가가 있으면 구매 골드에서 빠지지 않는다(PM-프론트 #238 P1).
  const noBundle = prices.map((p: { name: string }) =>
    p.name === "운명의 수호석" ? { ...p, bundlePrice: null } : p,
  );
  const kept = costLines([{ name: "운명의 수호석", amount: 601 }], {}, noBundle);
  assert.ok(Math.abs(kept.lines[0].purchase!.gold - 700 * 0.31) < 1e-9);
  assert.equal(kept.buyGold, 217);
  assert.deepEqual(kept.unpriced, []);
});

test("소모 가치 total adds raw refining gold and material value, then rounds once (#238 P2)", () => {
  // 계산 검증 case 2: 재련 골드 5,682.4 + 소모 가치 13,935.3 → 19,618 (not 5,683 + 13,936).
  const rawGold = 5682.4;
  const value = costLines([{ name: "운명의 수호석", amount: 44953, expected: 44952.6 }], {}, [
    { name: "운명의 수호석", status: "PRICED", unitPriceGold: 0.31, sourceItemName: "운명의 수호석", bundleCount: 100, bundlePrice: 31, contentsPerItem: null, observedAt: "2026-10-10T00:00:00Z" },
  ]).valueRaw;
  assert.ok(Math.abs(value - 44952.6 * 0.31) < 1e-6);
  assert.equal(Math.round(rawGold + value), Math.round(5682.4 + 13935.306));
  assert.ok(Math.round(rawGold + value) < Math.ceil(rawGold) + Math.ceil(value));
});

test("a total of nothing to buy reads 0, never -0 (계산 검증 #1127 P2)", () => {
  // Everything owned: nothing missing, 사야 할 골드 0.
  const owned = costLines([{ name: "운명의 수호석", amount: 600 }], { "운명의 수호석": 600 }, []);
  assert.ok(Object.is(owned.buyGold, 0), `owned: ${owned.buyGold}`);
  // No prices loaded yet.
  const none = costLines([{ name: "운명의 수호석", amount: 600 }], {}, null);
  assert.ok(Object.is(none.buyGold, 0), `no prices: ${none.buyGold}`);
  assert.equal(`${none.buyGold.toLocaleString("ko-KR")}`, "0");
});