// The armour CP gate on the web (ARMOR_CP_SIM, PM 총괄 11-21): off, every screen, request body and the proxy guard
// are as before (except 상급 재련, which the screen never sends there and the proxy now refuses); on, armour 재련 and
// 상급 재련 open, and the proxy takes them with exactly the simulator's fields inside the api's bounds.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ADVANCED_REFINE_MAX,
  NO_EDITS,
  REFINE_MAX,
  REFINE_MIN,
  isAdvancedRefineOpen,
  isRefineOpen,
  parseSimulateRequest,
  refineEdit,
  toChanges,
  type Current,
} from "../lib/combat-power/model";
import { simulatorPath, type GoalStep } from "../lib/spec-up/goal";
import { editsFor, type SpecUpChange } from "../lib/spec-up/model";
import { isArmorCpSimEnabled } from "../lib/tools/flags";

const name = "기준캐릭터A";
const body = (...changes: Record<string, unknown>[]) => ({ characterName: name, changes });
const types: Record<number, string> = { 0: "무기", 1: "투구", 2: "상의" };
const gearType = (index: number) => types[index];

test("ARMOR_CP_SIM: on/off override; otherwise hidden only on the production host, and never without the simulator", () => {
  const prod = { SITE_URL: "https://loakraken.gg", COMBAT_POWER_SIM: "on" };
  assert.equal(isArmorCpSimEnabled({ ...prod, ARMOR_CP_SIM: "on" }), true);
  assert.equal(isArmorCpSimEnabled({ ARMOR_CP_SIM: "off" }), false);
  assert.equal(isArmorCpSimEnabled(prod), false);
  assert.equal(isArmorCpSimEnabled({ SITE_URL: "http://localhost:3000" }), true);
  assert.equal(isArmorCpSimEnabled({ ARMOR_CP_SIM: "on", COMBAT_POWER_SIM: "off" }), false);
});

test("the guard's bounds are the api's options (the committed options fixture)", () => {
  const options = JSON.parse(readFileSync(new URL("./combat-power-fixtures/combat-power-options.json", import.meta.url), "utf8")).data;
  assert.deepEqual(
    { REFINE_MIN, REFINE_MAX, ADVANCED_REFINE_MAX },
    { REFINE_MIN: options.refineMin, REFINE_MAX: options.refineMax, ADVANCED_REFINE_MAX: options.advancedRefineMax },
  );
});

test("guard off: 재련 goes as before (any index, no new checks), every 상급 재련 is refused", () => {
  const refine = { kind: "EQUIPMENT_REFINE", index: 3, refine: 24 };
  assert.deepEqual(parseSimulateRequest(body(refine))?.changes, [refine]);
  // As before: the proxy did not check the refine range or the fields beside it.
  assert.deepEqual(parseSimulateRequest(body({ ...refine, refine: 99 }))?.changes, [{ ...refine, refine: 99 }]);
  assert.equal(parseSimulateRequest(body({ kind: "EQUIPMENT_ADVANCED_REFINE", index: 1, level: 20 })), null);
  assert.equal(parseSimulateRequest(body({ kind: "EQUIPMENT_ADVANCED_REFINE", index: 0, level: 20 }), { armor: false }), null);
});

test("guard on: exactly index + refine / index + level, inside the api's bounds", () => {
  const on = { armor: true };
  const refine = { kind: "EQUIPMENT_REFINE", index: 1, refine: REFINE_MAX };
  const advanced = { kind: "EQUIPMENT_ADVANCED_REFINE", index: 1, level: ADVANCED_REFINE_MAX };
  assert.deepEqual(parseSimulateRequest(body(refine, advanced), on)?.changes, [refine, advanced]);
  assert.deepEqual(parseSimulateRequest(body({ ...refine, refine: REFINE_MIN }, { ...advanced, level: 0 }), on)?.changes, [
    { ...refine, refine: REFINE_MIN },
    { ...advanced, level: 0 },
  ]);
  // Bad range.
  for (const bad of [
    { ...refine, refine: REFINE_MAX + 1 },
    { ...refine, refine: REFINE_MIN - 1 },
    { ...refine, index: -1 },
    { ...advanced, level: ADVANCED_REFINE_MAX + 1 },
    { ...advanced, level: -1 },
    { ...advanced, index: -1 },
    { ...refine, refine: 20.5 },
  ])
    assert.equal(parseSimulateRequest(body(bad), on), null, JSON.stringify(bad));
  // Wrong or missing fields for the kind.
  for (const bad of [
    { kind: "EQUIPMENT_REFINE", index: 1, level: 20 },
    { kind: "EQUIPMENT_REFINE", index: 1 },
    { ...refine, level: 3 },
    { kind: "EQUIPMENT_ADVANCED_REFINE", index: 1, refine: 20 },
    { kind: "EQUIPMENT_ADVANCED_REFINE", level: 20 },
    { ...advanced, slot: 0 },
  ])
    assert.equal(parseSimulateRequest(body(bad), on), null, JSON.stringify(bad));
});

test("an extra key on a refine change is a local 400, not stripped and sent on (PM-프론트 #1843 P2)", () => {
  const on = { armor: true };
  for (const change of [
    { kind: "EQUIPMENT_REFINE", index: 1, refine: 20, extra: true },
    { kind: "EQUIPMENT_REFINE", index: 1, refine: 20, characterName: "x" },
    { kind: "EQUIPMENT_ADVANCED_REFINE", index: 1, level: 20, extra: "dropped?" },
  ])
    assert.equal(parseSimulateRequest(body(change), on), null, JSON.stringify(change));
});

test("완갑: exactly level 0..25 and a grade the simulator offers (PM-프론트 P3)", () => {
  const guard = { kind: "ARM_GUARD", level: 20, grade: "고대" };
  for (const armor of [false, true]) {
    assert.deepEqual(parseSimulateRequest(body(guard), { armor })?.changes, [guard]);
    assert.deepEqual(parseSimulateRequest(body({ ...guard, level: 0, grade: "영웅" }), { armor })?.changes, [{ ...guard, level: 0, grade: "영웅" }]);
    for (const bad of [
      { ...guard, level: 26 },
      { ...guard, level: -1 },
      { ...guard, grade: "에스더" },
      { kind: "ARM_GUARD", level: 20 },
      { ...guard, extra: true },
      { ...guard, index: 3 },
    ])
      assert.equal(parseSimulateRequest(body(bad), { armor }), null, JSON.stringify(bad));
  }
});

test("open checks: off as before (weapon 재련 only, no 상급 재련); on, armour 재련 and 상급 재련, never weapon 상급 재련", () => {
  assert.equal(isRefineOpen("무기"), true);
  assert.equal(isRefineOpen("투구"), false);
  assert.equal(isAdvancedRefineOpen("투구"), false);
  assert.equal(isAdvancedRefineOpen("무기"), false);
  assert.equal(isRefineOpen("투구", true), true);
  assert.equal(isAdvancedRefineOpen("투구", true), true);
  assert.equal(isAdvancedRefineOpen("무기", true), false);
  assert.equal(isRefineOpen(null, true), false);
});

test("the change builder: armour 재련 goes out only with the flag", () => {
  const current: Current = { gems: [], gear: [{ index: 1, type: "투구", refine: 20, quality: 90, advanced: 10 }] };
  const range = { min: REFINE_MIN, max: REFINE_MAX };
  const edits = { ...NO_EDITS, refine: { 1: 22 } };
  assert.deepEqual(toChanges(edits, current, range), []);
  assert.deepEqual(toChanges(edits, { ...current, armor: true }, range), [{ kind: "EQUIPMENT_REFINE", index: 1, refine: 22 }]);
  assert.equal(refineEdit(22, current.gear[0], range), null);
  assert.equal(refineEdit(22, current.gear[0], range, true), 22);
});

test("spec-up hand-offs: armour 재련 · 상급 재련 open in the simulator only with the flag; weapon 상급 재련 never", () => {
  const armour = { kind: "EQUIPMENT_REFINE", index: 1, refine: 21 } as SpecUpChange;
  const advanced = { kind: "EQUIPMENT_ADVANCED_REFINE", index: 1, level: 30 } as SpecUpChange;
  const weaponAdvanced = { kind: "EQUIPMENT_ADVANCED_REFINE", index: 0, level: 30 } as SpecUpChange;
  assert.equal(editsFor(armour, NO_EDITS, gearType), null);
  assert.equal(editsFor(advanced, NO_EDITS, gearType), null);
  assert.deepEqual(editsFor(armour, NO_EDITS, gearType, true)?.refine, { 1: 21 });
  assert.deepEqual(editsFor(advanced, NO_EDITS, gearType, true)?.advanced, { 1: 30 });
  assert.equal(editsFor(weaponAdvanced, NO_EDITS, gearType, true), null);
  assert.equal(editsFor({ ...advanced, level: ADVANCED_REFINE_MAX + 1 } as SpecUpChange, NO_EDITS, gearType, true), null);
  const steps = [armour, advanced, weaponAdvanced].map((change) => ({ change }) as unknown as GoalStep);
  assert.deepEqual(simulatorPath(steps, gearType), { changes: [], skipped: 3 });
  assert.deepEqual(simulatorPath(steps, gearType, false, true), { changes: [armour, advanced], skipped: 1 });
});
