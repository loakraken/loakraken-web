import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultPart, PARTS, summarize, type PartId, type PartState } from "../lib/refining/model";
import {
  ADVANCED_PARTS,
  advancedRaisable,
  advancedRequests,
  advancedTotal,
  advancedView,
  bandValue,
  bumpAdvanced,
  initialAdvanced,
  joinAdvanced,
  nextBand,
  parseAdvancedRequest,
  policyText,
} from "../lib/refining/advanced";
import { priceNames } from "../lib/refining/breath";
import { isAdvancedEnvelope } from "../lib/refining/validate";
import { requestAdvancedPlan } from "../lib/refining/upstream";
import { isRefiningAdvancedEnabled } from "../lib/tools/flags";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
// The api's CI sample (api develop efb32b94, artifact openapi-contract), as the mock serves it.
const sample = () => read("./refining-fixtures/refining-advanced-plan.json");
const parts = (over: Partial<Record<PartId, Partial<PartState>>> = {}) =>
  Object.fromEntries(PARTS.map((part) => [part.id, { ...defaultPart(), ...over[part.id] }])) as Record<PartId, PartState>;
const helmet = ADVANCED_PARTS.find((part) => part.id === "helmet")!;

test("the api's sample (nulls in enhanced and expectedSilver) passes the contract check; another code does not", () => {
  assert.equal(isAdvancedEnvelope(sample()), true);
  assert.equal(isAdvancedEnvelope({ ...sample(), code: "REFINING_PLAN_SUCCESS" }), false);
  const noBands = sample();
  delete noBands.data.bands;
  assert.equal(isAdvancedEnvelope(noBands), false);
});

test("allow-list: 업화 weapon or armour, 0 ≤ from < to ≤ 40; 전율, 완갑 and anything else never reach the api", () => {
  assert.deepEqual(parseAdvancedRequest({ grade: "UPHWA", equipmentType: "ARMOR", fromStage: 0, toStage: 10, extra: 1 }), {
    grade: "UPHWA",
    equipmentType: "ARMOR",
    fromStage: 0,
    toStage: 10,
  });
  for (const bad of [
    { grade: "JEONYUL", equipmentType: "ARMOR", fromStage: 0, toStage: 10 },
    { grade: "UPHWA", equipmentType: "ARM_GUARD", fromStage: 0, toStage: 10 },
    { grade: "UPHWA", equipmentType: "ARMOR", fromStage: 10, toStage: 10 },
    { grade: "UPHWA", equipmentType: "ARMOR", fromStage: 0, toStage: 41 },
    { grade: "UPHWA", equipmentType: "ARMOR", fromStage: -1, toStage: 10 },
    { grade: "UPHWA", equipmentType: "WEAPON", fromStage: 1.5, toStage: 10 },
    null,
    [],
  ])
    assert.equal(parseAdvancedRequest(bad), null, JSON.stringify(bad));
});

test("the proxy refuses before any backend call, and passes the api's answer on", async () => {
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    return new Response(JSON.stringify(sample()), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  const refused = await requestAdvancedPlan({ grade: "JEONYUL", equipmentType: "ARMOR", fromStage: 0, toStage: 10 }, "http://127.0.0.1:8080", { fetcher });
  assert.deepEqual(refused, { ok: false, error: { code: "INVALID_REQUEST", status: 400 } });
  assert.equal(calls, 0);
  const answered = await requestAdvancedPlan({ grade: "UPHWA", equipmentType: "ARMOR", fromStage: 0, toStage: 20 }, "http://127.0.0.1:8080", { fetcher });
  assert.equal(answered.ok, true);
  assert.equal(calls, 1);
});

test("'상급 +10' moves each picked 업화 part to the next band boundary (0→10, 13→20, 40 stays); 전율 and unpicked stay", () => {
  assert.deepEqual([0, 9, 10, 13, 20, 39, 40].map(nextBand), [10, 10, 20, 20, 30, 40, 40]);
  const stages = { ...initialAdvanced(), helmet: { current: 13, target: 13 }, chest: { current: 0, target: 20 } };
  const p = parts({ pants: { grade: "JEONYUL" } });
  const next = bumpAdvanced(stages, p, ["helmet", "chest", "pants", "armGuard"]);
  assert.deepEqual(next.helmet, { current: 13, target: 20 });
  assert.deepEqual(next.chest, { current: 0, target: 30 });
  assert.deepEqual(next.pants, stages.pants);
  assert.deepEqual(next.weapon, stages.weapon);
  assert.equal(advancedRaisable(stages, p, ["pants"]), false);
  assert.equal(advancedRaisable({ ...stages, helmet: { current: 40, target: 40 } }, p, ["helmet"]), false);
  assert.equal(advancedRaisable(stages, p, ["helmet"]), true);
});

test("requests: one per 업화 part in the plan whose target is above its current", () => {
  const stages = { ...initialAdvanced(), weapon: { current: 5, target: 10 }, helmet: { current: 0, target: 20 }, chest: { current: 0, target: 10 } };
  const keys = advancedRequests(stages, parts({ chest: { enabled: false } })).map(({ part, request }) => [part.id, request]);
  assert.deepEqual(keys, [
    ["weapon", { grade: "UPHWA", equipmentType: "WEAPON", fromStage: 5, toStage: 10 }],
    ["helmet", { grade: "UPHWA", equipmentType: "ARMOR", fromStage: 0, toStage: 20 }],
  ]);
});

test("the sample's bands as the page reads them: policy in our words, nulls kept, materials whole", () => {
  const view = advancedView(helmet, sample().data);
  assert.equal(view.bands.length, 2);
  assert.deepEqual(
    view.bands.map((band) => [band.from, band.to, band.turns, band.policy, band.silver]),
    [
      [0, 10, 43.25, "일반 안 씀 · 선조 숨결", 111752.1],
      [10, 20, 43.25, "일반 안 씀 · 선조 숨결", null],
    ],
  );
  assert.deepEqual(view.temperingStages, [10]);
  assert.equal(view.policyLimited, true);
  assert.equal(policyText("SOMETHING_NEW"), "SOMETHING_NEW");
  assert.equal(policyText("BOTH"), "숨결 · 책");
});

test("joining the page total: 상급 materials merged with the 일반 ones before rounding, refine gold added once", () => {
  const total = advancedTotal([advancedView(helmet, sample().data)]);
  // The sample's own band sums (the api's plan-level expectedMaterials / expectedRefineGold agree within rounding).
  assert.ok(Math.abs(total.gold - 53915.49) < 0.01);
  assert.ok(Math.abs(total.materials.find((m) => m.name === "운명의 수호석")!.amount - 16468.73) < 0.01);
  const base = { materials: [{ name: "운명의 수호석", amount: 101, expected: 100.4 }], gold: 1001, rawGold: 1000.5, attempts: 3, stageCount: 2 };
  const joined = joinAdvanced(base, total);
  assert.equal(joined.materials.find((m) => m.name === "운명의 수호석")!.amount, Math.ceil(100.4 + 5881.69 + 10587.04 - 1e-9));
  assert.equal(joined.gold, Math.ceil(1000.5 + 18625.35 + 35290.14 - 1e-9));
  assert.equal(joined.attempts, 3);
  assert.equal(joined.stageCount, 2);
  assert.equal(joinAdvanced(base, null), base);
  // No 일반 plan: the summary of nothing plus the bands.
  assert.equal(joinAdvanced(summarize([], "expected"), total).materials.length, 5);
});

test("a band's value at the page's prices; unpriced materials left out and flagged; no prices, no value", () => {
  const band = advancedView(helmet, sample().data).bands[0];
  const prices = band.materials.map((m, i) => ({ name: m.name, status: i === 0 ? "MISSING" : "PRICED", unitPriceGold: 2 }));
  const value = bandValue(band, prices)!;
  const expected = band.refineGold + band.materials.slice(1).reduce((sum, m) => sum + m.amount * 2, 0);
  assert.equal(value.value, Math.ceil(expected - 1e-9));
  assert.equal(value.unpriced, true);
  assert.equal(bandValue(band, null), null);
});

test("REFINING_ADVANCED: off on every deployment unless set on (paired with the api's switch)", () => {
  assert.equal(isRefiningAdvancedEnabled({}), false);
  assert.equal(isRefiningAdvancedEnabled({ SITE_URL: "http://127.0.0.1:3000" }), false);
  assert.equal(isRefiningAdvancedEnabled({ REFINING_ADVANCED: "off" }), false);
  assert.equal(isRefiningAdvancedEnabled({ REFINING_ADVANCED: " ON " }), true);
});

test("price names: the 상급 materials join the list once, the same from both callers (one price query)", () => {
  const names = priceNames([], "expected", ["운명의 수호석", "운명의 수호석", "운명의 파편"]);
  assert.deepEqual(names, ["운명의 수호석", "운명의 파편"]);
});
