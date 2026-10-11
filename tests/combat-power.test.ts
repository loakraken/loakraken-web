import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  NO_EDITS,
  braceletName,
  gradeWithValue,
  polishValue,
  isOpen,
  gemLevel,
  hasComputed,
  parseSimulateRequest,
  toChanges,
} from "../lib/combat-power/model";
import { isOptionsEnvelope, isSimulateEnvelope } from "../lib/combat-power/validate";
import { requestSimulation } from "../lib/combat-power/upstream";
import { isCombatPowerEnabled } from "../lib/tools/flags";

const origin = "http://127.0.0.1:8080";
const read = (name: string) =>
  JSON.parse(readFileSync(new URL(`./combat-power-fixtures/${name}`, import.meta.url), "utf8"));

const current = {
  gems: [
    { slot: 0, level: 8 },
    { slot: 1, level: 10 },
  ],
  gear: [
    { index: 0, refine: 20, quality: 90 },
    { index: 1, refine: null, quality: 100 },
  ],
};

test("only real differences become changes, in a fixed order", () => {
  assert.deepEqual(toChanges(NO_EDITS, current), []);
  assert.deepEqual(
    toChanges({ ...NO_EDITS, refine: { 0: 20 }, quality: { 1: 100 } }, current),
    [],
  );
  assert.deepEqual(
    toChanges({ ...NO_EDITS, gemAll: 9, gems: { 1: 10 }, refine: { 0: 22, 1: 25 }, quality: { 0: 100 } }, current),
    [
      { kind: "GEM_LEVEL_ALL", level: 9 },
      { kind: "GEM_LEVEL", slot: 1, level: 10 },
      { kind: "EQUIPMENT_REFINE", index: 0, refine: 22 },
      { kind: "EQUIPMENT_QUALITY", index: 0, quality: 100 },
    ],
  );
  // A bulk level equal to every gem changes nothing.
  assert.deepEqual(
    toChanges({ ...NO_EDITS, gemAll: 8 }, { ...current, gems: [{ slot: 0, level: 8 }] }),
    [],
  );
  assert.equal(gemLevel({ ...NO_EDITS, gemAll: 7 }, current.gems[0]), 7);
  assert.equal(gemLevel({ ...NO_EDITS, gemAll: 7, gems: { 0: 6 } }, current.gems[0]), 6);
});

test("polish, bracelet, engravings, stones, ark passive and cores become backend changes", () => {
  const full = {
    ...current,
    polish: [{ index: 3, line: 0, option: "추가 피해", grade: "LOW" as const }],
    bracelet: [{ line: 1, name: "치명타 피해", grade: "MID" as const }],
    engravings: [{ name: "원한", level: 3 }],
    stones: [{ name: "원한", level: 1 }],
    arkPassive: [{ tree: "진화", points: 100 }],
    cores: [{ slotIndex: 0, grade: "유물", point: 17 }],
  };
  // Same values as now: nothing to send.
  assert.deepEqual(
    toChanges(
      {
        ...NO_EDITS,
        polish: { "3:0": "LOW" },
        engraving: { 원한: 3 },
        core: { 0: { grade: "유물", point: 17 } },
      },
      full,
    ),
    [],
  );
  assert.deepEqual(
    toChanges(
      {
        ...NO_EDITS,
        polish: { "3:0": "HIGH" },
        bracelet: { 1: "HIGH" },
        engraving: { 원한: 4 },
        stone: { 원한: 2 },
        arkPassive: { 진화: 120 },
        core: { 0: { grade: "고대", point: 20 } },
      },
      full,
    ),
    [
      { kind: "POLISH", index: 3, line: 0, option: "추가 피해", grade: "HIGH" },
      { kind: "BRACELET_EFFECT", line: 1, name: "치명타 피해", grade: "HIGH" },
      { kind: "ENGRAVING_LEVEL", name: "원한", level: 4 },
      { kind: "STONE_ENGRAVING", name: "원한", level: 2 },
      { kind: "ARK_PASSIVE_POINT", tree: "진화", points: 120 },
      { kind: "ARK_GRID_CORE", slotIndex: 0, grade: "고대", point: 20 },
    ],
  );
  assert.equal(braceletName("치명타 피해 +8.40%"), "치명타 피해");
  assert.equal(braceletName("특화 +100"), "특화");
});

test("advanced refining becomes EQUIPMENT_ADVANCED_REFINE (search advancedRefineLevel, web #374)", () => {
  const gear = { ...current, gear: [{ index: 0, refine: 20, quality: 90, advanced: 10 }] };
  assert.deepEqual(toChanges({ ...NO_EDITS, advanced: { 0: 10 } }, gear), []);
  assert.deepEqual(toChanges({ ...NO_EDITS, advanced: { 0: 20 } }, gear), [
    { kind: "EQUIPMENT_ADVANCED_REFINE", index: 0, level: 20 },
  ]);
  // No current step read from the tooltip: nothing to change from.
  assert.deepEqual(toChanges({ ...NO_EDITS, advanced: { 0: 20 } }, current), []);
});

test("the proxy forwards only known kinds with integer or short string fields", () => {
  const ok = parseSimulateRequest({
    characterName: " 언새늘 ",
    changes: [{ kind: "GEM_LEVEL", slot: 0, level: 10, extra: "dropped" }],
  });
  assert.deepEqual(ok, { characterName: "언새늘", changes: [{ kind: "GEM_LEVEL", slot: 0, level: 10 }] });
  assert.equal(parseSimulateRequest({ characterName: "언새늘", changes: [{ kind: "NOPE" }] }), null);
  assert.equal(parseSimulateRequest({ characterName: "언새늘", changes: [{ kind: "GEM_LEVEL", level: 1.5 }] }), null);
  assert.equal(
    parseSimulateRequest({ characterName: "언새늘", changes: Array(65).fill({ kind: "GEM_LEVEL_ALL", level: 1 }) }),
    null,
  );
  assert.equal(parseSimulateRequest({ characterName: "", changes: [] }), null);
});

test("backend #240 samples pass the contract validators; stage A computes nothing", () => {
  const simulation = read("character-combat-power-simulate.json");
  assert.equal(isSimulateEnvelope(simulation), true);
  assert.equal(isOptionsEnvelope(read("combat-power-options.json")), true);
  assert.equal(hasComputed(simulation.data), false);
  // A newer status from the backend does not blank the screen.
  simulation.data.contributions[0].status = "ESTIMATED";
  assert.equal(isSimulateEnvelope(simulation), true);
  assert.equal(isSimulateEnvelope({ ...simulation, code: "OTHER" }), false);
});

test("simulate requests validate input and pass through allow-listed errors", async () => {
  let calls = 0;
  const fetcher = (async (url: URL, init: RequestInit) => {
    calls++;
    assert.equal(url.pathname, "/api/v1/characters/combat-power/simulate");
    assert.equal(init.method, "POST");
    return Response.json(read("character-combat-power-simulate.json"));
  }) as unknown as typeof fetch;
  const body = { characterName: "언새늘", changes: [{ kind: "GEM_LEVEL_ALL", level: 10 }] };
  assert.equal((await requestSimulation(body, origin, { fetcher })).ok, true);
  assert.equal((await requestSimulation({ characterName: "언새늘", changes: "x" }, origin, { fetcher })).ok, false);
  assert.equal(calls, 1);
  const moved = await requestSimulation(body, origin, {
    fetcher: (async () =>
      Response.json({ code: "CHANGE_TARGET_NOT_FOUND" }, { status: 409 })) as typeof fetch,
  });
  assert.deepEqual(moved.ok ? null : moved.error, { code: "CHANGE_TARGET_NOT_FOUND", status: 409 });
});

test("the simulator is hidden on the production host unless turned on", () => {
  assert.equal(isCombatPowerEnabled({ SITE_URL: "https://loakraken.gg" }), false);
  assert.equal(isCombatPowerEnabled({ SITE_URL: "https://loakraken.gg", COMBAT_POWER_SIM: "on" }), true);
  assert.equal(isCombatPowerEnabled({ SITE_URL: "http://127.0.0.1:3402" }), true);
  assert.equal(isCombatPowerEnabled({ COMBAT_POWER_SIM: "off" }), false);
});

test("1차판 opens only the kinds that matched the target site (PM 총괄 23:59)", () => {
  assert.deepEqual(
    ["GEM_LEVEL_ALL", "GEM_LEVEL", "EQUIPMENT_QUALITY", "ENGRAVING_LEVEL", "STONE_ENGRAVING"].map((k) => isOpen(k as never)),
    [true, true, true, true, true],
  );
  assert.deepEqual(
    ["EQUIPMENT_REFINE", "EQUIPMENT_ADVANCED_REFINE", "POLISH", "BRACELET_EFFECT", "ARK_PASSIVE_POINT", "ARK_GRID_CORE"].map((k) =>
      isOpen(k as never),
    ),
    [false, false, false, false, false, false],
  );
});

test("polish grades read with their official value (backend #254, PM-프론트 #370 P2)", () => {
  const options = read("combat-power-options.json");
  assert.equal(isOptionsEnvelope(options), true);
  const values = options.data.polishValues;
  assert.equal(polishValue(values, "추가 피해", true, "HIGH"), "+2.60%");
  // Same name, % or flat: told apart by the current value.
  assert.equal(polishValue(values, "공격력", true, "MID"), "+0.95%");
  assert.equal(polishValue(values, "공격력", false, "MID"), "+195");
  assert.equal(polishValue(values, "없는 옵션", true, "HIGH"), null);
  assert.equal(polishValue(undefined, "추가 피해", true, "HIGH"), null);
  assert.equal(gradeWithValue("HIGH", "+2.60%"), "상(+2.60%)");
  assert.equal(gradeWithValue("LOW", null), "하");
  // Backends before #254 send no table: still a valid answer.
  delete options.data.polishValues;
  assert.equal(isOptionsEnvelope(options), true);
});
