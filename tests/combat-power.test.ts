import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  NO_EDITS,
  hasNoAdvancedRefine,
  braceletName,
  gradeWithValue,
  polishValue,
  polishOptionText,
  polishSwapOf,
  polishSwapValue,
  wornPolish,
  POLISH_NONE,
  ARK_PASSIVE_MAX,
  arkPassiveMax,
  arkPassiveNote,
  isArkPassiveOpen,
  isCoreOpen,
  isOpen,
  isRefineOpen,
  gemLevel,
  hasComputed,
  parseSimulateRequest,
  refineEdit,
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
    { index: 0, type: "무기", refine: 20, quality: 90 },
    { index: 1, type: "투구", refine: null, quality: 100 },
  ],
};

test("a refine edit is sent only for the weapon, inside refineMin..refineMax, and not the step worn (codex #1555, #1567)", () => {
  const range = { min: 10, max: 25 };
  const weapon = { index: 0, type: "무기", refine: 8, quality: null };
  const helmet = { index: 1, type: "투구", refine: 19, quality: null };
  const gear = { ...current, gems: [], gear: [weapon, helmet] };
  // +8 under refineMin: picking 8 back is no edit; 10 goes out.
  assert.equal(refineEdit(8, weapon, range), null);
  assert.equal(refineEdit(10, weapon, range), 10);
  assert.deepEqual(toChanges({ ...NO_EDITS, refine: { 0: 10 } }, gear, range), [{ kind: "EQUIPMENT_REFINE", index: 0, refine: 10 }]);
  // The saved no-op 8 read after the weapon was honed to 12 in game: out of range, not sent, the row shows 12.
  const honed = { ...gear, gear: [{ ...weapon, refine: 12 }, helmet] };
  assert.equal(refineEdit(8, honed.gear[0], range), null);
  assert.deepEqual(toChanges({ ...NO_EDITS, refine: { 0: 8 } }, honed, range), []);
  // Past refineMax (a spec-up step the options do not list): not sent.
  assert.deepEqual(toChanges({ ...NO_EDITS, refine: { 0: 26 } }, honed, range), []);
  // Armour refine is UNSUPPORTED at the api (MODEL_UNCONFIRMED): never sent, whatever the edit says.
  assert.equal(refineEdit(20, helmet, range), null);
  assert.deepEqual(toChanges({ ...NO_EDITS, refine: { 1: 20 } }, gear, range), []);
  // Options not loaded yet (codex #1572 P3): the range is unknown, so nothing is sent yet, in range or not;
  // the same edits give the change once the range is there.
  const worn20 = { ...gear, gear: [{ ...weapon, refine: 20 }, helmet] };
  for (const early of [null, undefined]) {
    assert.equal(refineEdit(21, worn20.gear[0], early), null);
    assert.equal(refineEdit(8, honed.gear[0], early), null);
    assert.deepEqual(toChanges({ ...NO_EDITS, refine: { 0: 21 } }, worn20, early), []);
  }
  assert.deepEqual(toChanges({ ...NO_EDITS, refine: { 0: 21 } }, worn20, range), [{ kind: "EQUIPMENT_REFINE", index: 0, refine: 21 }]);
});

test("only real differences become changes, in a fixed order", () => {
  assert.deepEqual(toChanges(NO_EDITS, current), []);
  assert.deepEqual(
    toChanges({ ...NO_EDITS, refine: { 0: 20 }, quality: { 1: 100 } }, current),
    [],
  );
  assert.deepEqual(
    toChanges({ ...NO_EDITS, gemAll: 9, gems: { 1: 10 }, refine: { 0: 22, 1: 25 }, quality: { 0: 100 } }, current, { min: 10, max: 25 }),
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
    arkPassive: [{ tree: "도약", points: 60 }],
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
        arkPassive: { 도약: 70 },
        core: { 0: { grade: "고대", point: 20 } },
      },
      full,
    ),
    [
      { kind: "POLISH", index: 3, line: 0, option: "추가 피해", grade: "HIGH" },
      { kind: "BRACELET_EFFECT", line: 1, name: "치명타 피해", grade: "HIGH" },
      { kind: "ENGRAVING_LEVEL", name: "원한", level: 4 },
      { kind: "STONE_ENGRAVING", name: "원한", level: 2 },
      { kind: "ARK_PASSIVE_POINT", tree: "도약", points: 70 },
      { kind: "ARK_GRID_CORE", slotIndex: 0, grade: "고대", point: 20 },
    ],
  );
  assert.equal(braceletName("치명타 피해 +8.40%"), "치명타 피해");
  assert.equal(braceletName("특화 +100"), "특화");
});

test("a 연마 step's other option (api #951) goes out with its grade; a NONE line goes out with none", () => {
  const worn = {
    ...current,
    polish: [
      { index: 3, line: 0, option: "적에게 주는 피해", grade: "LOW" as const },
      { index: 3, line: 1, option: "추가 피해", grade: "HIGH" as const },
      { index: 3, line: 2, option: "공격력", grade: "MID" as const },
    ],
  };
  const edits = {
    ...NO_EDITS,
    polish: { "3:0": "HIGH" as const, "3:1": "HIGH" as const },
    polishOption: { "3:0": "추가 피해 %", "3:1": "적에게 주는 피해 %", "3:2": POLISH_NONE },
  };
  // Every line of the new accessory is sent, even one whose grade is the worn one's (another option is a change).
  assert.deepEqual(toChanges(edits, worn), [
    { kind: "POLISH", index: 3, line: 0, option: "추가 피해 %", grade: "HIGH" },
    { kind: "POLISH", index: 3, line: 1, option: "적에게 주는 피해 %", grade: "HIGH" },
    { kind: "POLISH", index: 3, line: 2, option: "NONE" },
  ]);
  // The proxy lets a NONE line (no grade) through.
  assert.deepEqual(parseSimulateRequest({ characterName: "모험가", changes: toChanges(edits, worn) })?.changes[2], {
    kind: "POLISH",
    index: 3,
    line: 2,
    option: "NONE",
  });
  // Never the raw code on screen, and the request's " %" mark is not shown.
  assert.equal(polishOptionText(POLISH_NONE), "점수 옵션 없는 줄");
  assert.equal(polishOptionText("추가 피해 %"), "추가 피해");
  assert.equal(polishOptionText("공격력"), "공격력");
  // The new option's value comes from the table by its own name and % mark.
  const values = read("combat-power-options.json").data.polishValues;
  assert.equal(polishSwapValue(values, "추가 피해 %", "HIGH"), "+2.60%");
  assert.equal(polishSwapValue(values, "추가 피해", "HIGH"), null, "no flat 추가 피해 row");
  assert.equal(polishSwapValue(values, "모르는 옵션 %", "HIGH"), null);
  // The accessory's part when known (review P3 #1700): 추가 피해 is a 목걸이 option.
  assert.equal(polishSwapValue(values, "추가 피해 %", "HIGH", "목걸이"), "+2.60%");
  assert.equal(polishSwapValue(values, "추가 피해 %", "HIGH", "반지"), null);
});

test("a line set back to its worn option (api #951 reset line) is the worn line; 되돌리기 drops one line", () => {
  const worn = {
    ...current,
    polish: [
      { index: 3, line: 0, option: "추가 피해", grade: "MID" as const, value: "+1.60%" },
      { index: 3, line: 1, option: "공격력", grade: "LOW" as const, value: "+80" },
    ],
  };
  // The worn option at the worn grade: no change, and no swapped row.
  const same = { ...NO_EDITS, polish: { "3:0": "MID" as const, "3:1": "LOW" as const }, polishOption: { "3:0": "추가 피해 %", "3:1": "공격력" } };
  assert.equal(polishSwapOf(same, worn.polish[0]), null);
  assert.equal(polishSwapOf(same, worn.polish[1]), null);
  assert.deepEqual(toChanges(same, worn), []);
  // The worn option at another grade: an ordinary grade edit of the worn line.
  assert.deepEqual(toChanges({ ...same, polish: { ...same.polish, "3:0": "HIGH" } }, worn), [
    { kind: "POLISH", index: 3, line: 0, option: "추가 피해", grade: "HIGH" },
  ]);
  // A % option where the worn line is flat (or the other way) is another option.
  assert.equal(polishSwapOf({ ...NO_EDITS, polishOption: { "3:1": "공격력 %" } }, worn.polish[1]), "공격력 %");
  // 되돌리기: that line's option and grade go, the others stay.
  const swapped = { ...NO_EDITS, polish: { "3:0": "HIGH" as const }, polishOption: { "3:0": "적에게 주는 피해 %", "3:1": POLISH_NONE } };
  const back = wornPolish(swapped, "3:0");
  assert.deepEqual([back.polish, back.polishOption], [{}, { "3:1": POLISH_NONE }]);
  assert.deepEqual(toChanges(back, worn), [{ kind: "POLISH", index: 3, line: 1, option: "NONE" }]);
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
    characterName: " 기준캐릭터A ",
    changes: [{ kind: "GEM_LEVEL", slot: 0, level: 10, extra: "dropped" }],
  });
  assert.deepEqual(ok, { characterName: "기준캐릭터A", changes: [{ kind: "GEM_LEVEL", slot: 0, level: 10 }] });
  assert.equal(parseSimulateRequest({ characterName: "기준캐릭터A", changes: [{ kind: "NOPE" }] }), null);
  assert.equal(parseSimulateRequest({ characterName: "기준캐릭터A", changes: [{ kind: "GEM_LEVEL", level: 1.5 }] }), null);
  assert.equal(
    parseSimulateRequest({ characterName: "기준캐릭터A", changes: Array(65).fill({ kind: "GEM_LEVEL_ALL", level: 1 }) }),
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
  const body = { characterName: "기준캐릭터A", changes: [{ kind: "GEM_LEVEL_ALL", level: 10 }] };
  assert.equal((await requestSimulation(body, origin, { fetcher })).ok, true);
  assert.equal((await requestSimulation({ characterName: "기준캐릭터A", changes: "x" }, origin, { fetcher })).ok, false);
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

test("1차판 opens only the kinds that passed verification (PM 총괄 23:59)", () => {
  assert.deepEqual(
    // sim v8: bracelet families (#332) and 팔 보호구 (#342); polish lines (api #460).
    // api #838: ark grid cores (PM 총괄 11-15).
    ["GEM_LEVEL_ALL", "GEM_LEVEL", "EQUIPMENT_QUALITY", "ENGRAVING_LEVEL", "STONE_ENGRAVING", "BRACELET_EFFECT", "ARM_GUARD", "POLISH", "ARK_GRID_CORE"].map(
      (k) => isOpen(k as never),
    ),
    [true, true, true, true, true, true, true, true, true],
  );
  assert.deepEqual(
    ["EQUIPMENT_REFINE", "EQUIPMENT_ADVANCED_REFINE", "ARK_PASSIVE_POINT"].map((k) => isOpen(k as never)),
    [false, false, false],
  );
});

test("ark passive opens 도약 (api #842), 진화 and 깨달음 (api #965), each to its in-game maximum; the 혼돈의 별 : 무기 core stays locked (api #838)", () => {
  assert.deepEqual(
    ["도약", "진화", "깨달음"].map((tree) => isArkPassiveOpen(tree)),
    [true, true, true],
  );
  // The in-game maxima (PM 총괄 11-16, sources in model.ts): 도약 70, 진화 140, 깨달음 101; a tree without one keeps the api range.
  assert.deepEqual(
    [arkPassiveMax("도약"), arkPassiveMax("진화"), arkPassiveMax("깨달음"), arkPassiveMax("모르는 트리")],
    [70, 140, 101, ARK_PASSIVE_MAX],
  );
  const trees = {
    ...current,
    arkPassive: [
      { tree: "진화", points: 120 },
      { tree: "깨달음", points: 95 },
    ],
  };
  // At the maximum it goes out (깨달음 101 too: the api answers it as not computed); one over never does.
  assert.deepEqual(toChanges({ ...NO_EDITS, arkPassive: { 진화: 140, 깨달음: 101 } }, trees), [
    { kind: "ARK_PASSIVE_POINT", tree: "진화", points: 140 },
    { kind: "ARK_PASSIVE_POINT", tree: "깨달음", points: 101 },
  ]);
  assert.deepEqual(toChanges({ ...NO_EDITS, arkPassive: { 진화: 141, 깨달음: 102 } }, trees), []);
  const leap = { ...current, arkPassive: [{ tree: "도약", points: 60 }] };
  assert.deepEqual(toChanges({ ...NO_EDITS, arkPassive: { 도약: 70 } }, leap), [
    { kind: "ARK_PASSIVE_POINT", tree: "도약", points: 70 },
  ]);
  // 71 cannot exist in game: not sent (an old saved input, say).
  assert.deepEqual(toChanges({ ...NO_EDITS, arkPassive: { 도약: 71 } }, leap), []);
  assert.deepEqual(
    ["질서의 해 코어 : 테스트", "혼돈의 별 코어 : 공격", "혼돈의 별 코어 : 무기", " 혼돈의 별 코어 : 무기"].map((name) =>
      isCoreOpen(name),
    ),
    [true, true, false, false],
  );
  // A locked row sends nothing even with an edit in hand (an old saved input, say).
  const worn = {
    ...current,
    arkPassive: [
      { tree: "진화", points: 120 },
      { tree: "도약", points: 60 },
    ],
    cores: [
      { slotIndex: 0, name: "질서의 해 코어 : 테스트", grade: "유물", point: 14 },
      { slotIndex: 1, name: "혼돈의 별 코어 : 무기", grade: "유물", point: 17 },
    ],
  };
  assert.deepEqual(
    toChanges(
      {
        ...NO_EDITS,
        arkPassive: { 진화: 140, 도약: 70 },
        core: { 0: { grade: "고대", point: 20 }, 1: { grade: "고대", point: 20 } },
      },
      worn,
    ),
    [
      { kind: "ARK_PASSIVE_POINT", tree: "진화", points: 140 },
      { kind: "ARK_PASSIVE_POINT", tree: "도약", points: 70 },
      { kind: "ARK_GRID_CORE", slotIndex: 0, grade: "고대", point: 20 },
    ],
  );
});

test("the note beside a tree's field: its maximum, and 깨달음 over 100 (now or typed) is said not computed (api #965)", () => {
  assert.equal(arkPassiveNote("도약", 60, 60), "최대 70");
  assert.equal(arkPassiveNote("진화", 120, 140), "최대 140");
  assert.equal(arkPassiveNote("깨달음", 95, 100), "최대 101", "computed at 100 or less");
  assert.equal(arkPassiveNote("깨달음", 95, 101), "최대 101 · 100을 넘는 값은 아직 계산하지 않아요", "typed 101");
  for (const next of [101, 90])
    assert.equal(
      arkPassiveNote("깨달음", 101, next),
      "최대 101 · 지금 값이 100을 넘어 바꿔도 아직 계산하지 않아요",
      "now 101: the api does not compute a change either way",
    );
  assert.equal(arkPassiveNote("모르는 트리", 1, 2), undefined);
});

test("refine opens for the weapon only (api #884 weapon OK, armour UNSUPPORTED; PM 총괄 11-12)", () => {
  assert.deepEqual(
    ["무기", "투구", "상의", "하의", "장갑", "어깨", null].map((type) => isRefineOpen(type)),
    [true, false, false, false, false, false, false],
  );
});

test("polish grades read with their official value (backend #254, PM-프론트 #370 P2)", () => {
  const options = read("combat-power-options.json");
  assert.equal(isOptionsEnvelope(options), true);
  const values = options.data.polishValues;
  const mid = { value: "+1.60%", grade: "MID" };
  assert.equal(polishValue(values, "추가 피해", mid, "HIGH"), "+2.60%");
  // Same name, % or flat: told apart by the current value.
  assert.equal(polishValue(values, "공격력", { value: "+0.95%", grade: "MID" }, "HIGH"), "+1.55%");
  assert.equal(polishValue(values, "공격력", { value: "+195", grade: "MID" }, "HIGH"), "+390");
  // Another tier (1540 공격력 % 중 0.66): the 1680 table does not fit → grade only.
  assert.equal(polishValue(values, "공격력", { value: "+0.66%", grade: "MID" }, "HIGH"), null);
  // Grade unknown (change list "from"): fits when the value is in the row.
  assert.equal(polishValue(values, "추가 피해", { value: "+1.60%", grade: null }, "HIGH"), "+2.60%");
  assert.equal(polishValue(values, "추가 피해", { value: "+1.10%", grade: null }, "HIGH"), null);
  assert.equal(polishValue(values, "없는 옵션", mid, "HIGH"), null);
  assert.equal(polishValue(undefined, "추가 피해", mid, "HIGH"), null);
  assert.equal(gradeWithValue("HIGH", "+2.60%"), "상(+2.60%)");
  assert.equal(gradeWithValue("LOW", null), "하");
  // Since sim v8 the table (and braceletOptions) is part of the contract.
  delete options.data.polishValues;
  assert.equal(isOptionsEnvelope(options), false);
});

test("전율 gear has no advanced refining, so it is never shown as pending (PM-프론트 P1, A21)", () => {
  assert.equal(hasNoAdvancedRefine("+20 전율의 투구"), true);
  assert.equal(hasNoAdvancedRefine("+19 테스트 투구"), false);
  assert.equal(hasNoAdvancedRefine(null), false);
});
