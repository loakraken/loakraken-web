// 깨달음 카르마 레벨 in the simulator (api #1004, web #1781).
import assert from "node:assert/strict";
import test from "node:test";
import { KARMA_MAX, NO_EDITS, karmaLevelOf, parseSimulateRequest, toChanges, type Current, type Edits } from "../lib/combat-power/model";
import { applySaved, parseSaved, targetsOf, type Identity } from "../lib/combat-power/history";
import { simulatorPath, type GoalStep } from "../lib/spec-up/goal";
import { editsFor, readTryPath, tryPathParam, type SpecUpChange } from "../lib/spec-up/model";
import { isKarmaSimEnabled } from "../lib/tools/flags";
import { requestSimulation } from "../lib/combat-power/upstream";

const karmaChange = (karmaLevel: number) => ({ kind: "ARK_PASSIVE_POINT", tree: "깨달음", karmaLevel }) as SpecUpChange;

test("the karma level is read from the 깨달음 point description, as the api reads it (first N레벨)", () => {
  assert.equal(karmaLevelOf([{ name: "진화", description: "3랭크 9레벨" }, { name: "깨달음", description: "6랭크 29레벨" }]), 29);
  assert.equal(karmaLevelOf([{ name: "깨달음", description: "1랭크 0레벨" }]), 0);
  // Not readable: no field (the api answers that it could not read it).
  assert.equal(karmaLevelOf([{ name: "깨달음", description: "포인트 설명" }]), null);
  assert.equal(karmaLevelOf([{ name: "깨달음", description: null }]), null);
  assert.equal(karmaLevelOf([{ name: "진화", description: "6랭크 29레벨" }]), null);
  assert.equal(karmaLevelOf(null), null);
  // Past the request's range (0~30): not a level the api takes.
  assert.equal(karmaLevelOf([{ name: "깨달음", description: "6랭크 31레벨" }]), null);
});

test("the api's karmaLevel (api #1023) wins; the description is read only when the field is absent or null", () => {
  // The field.
  assert.equal(karmaLevelOf([{ name: "깨달음", description: "6랭크 29레벨", karmaLevel: 29 }]), 29);
  assert.equal(karmaLevelOf([{ name: "깨달음", description: null, karmaLevel: 0 }]), 0);
  // No field (an api before #1023) or null (the api could not read a level): the description.
  assert.equal(karmaLevelOf([{ name: "깨달음", description: "6랭크 29레벨" }]), 29);
  assert.equal(karmaLevelOf([{ name: "깨달음", description: "6랭크 29레벨", karmaLevel: null }]), 29);
  // The field and the description disagree: the field wins.
  assert.equal(karmaLevelOf([{ name: "깨달음", description: "6랭크 29레벨", karmaLevel: 27 }]), 27);
  // Every point carries a level (진화 '6랭크 30레벨' → 30): the 깨달음 point's, never the first one.
  assert.equal(
    karmaLevelOf([
      { name: "진화", description: "6랭크 30레벨", karmaLevel: 30 },
      { name: "깨달음", description: "6랭크 25레벨", karmaLevel: 25 },
      { name: "도약", description: "5랭크 20레벨", karmaLevel: 20 },
    ]),
    25,
  );
  assert.equal(karmaLevelOf([{ name: "진화", description: "6랭크 30레벨", karmaLevel: 30 }]), null);
  // A field outside 0~30 is not a level the request takes, and the description is not read in its place.
  assert.equal(karmaLevelOf([{ name: "깨달음", description: "6랭크 29레벨", karmaLevel: 31 }]), null);
  assert.equal(karmaLevelOf([{ name: "깨달음", description: "6랭크 29레벨", karmaLevel: -1 }]), null);
});

test("a karma edit goes out as ARK_PASSIVE_POINT 깨달음 karmaLevel, never with points, and only where the screen edits it", () => {
  const current: Current = { gems: [], gear: [], arkPassive: [{ tree: "깨달음", points: 101 }], karma: 29 };
  const edits: Edits = { ...NO_EDITS, karma: { 깨달음: 30 } };
  assert.deepEqual(toChanges(edits, current), [{ kind: "ARK_PASSIVE_POINT", tree: "깨달음", karmaLevel: 30 }]);
  // The level worn, a level past the range, or a screen without the field (karma unset): nothing.
  assert.deepEqual(toChanges({ ...NO_EDITS, karma: { 깨달음: 29 } }, current), []);
  assert.deepEqual(toChanges({ ...NO_EDITS, karma: { 깨달음: KARMA_MAX + 1 } }, current), []);
  assert.deepEqual(toChanges(edits, { ...current, karma: null }), []);
  assert.deepEqual(toChanges(edits, { ...current, karma: undefined }), []);
});

test("the proxy passes karmaLevel on only as the api takes it, and only with KARMA_SIM on (PM 총괄 #1815 P2)", () => {
  const body = (change: Record<string, unknown>) => ({ characterName: "테스트", changes: [change] });
  const on = { karma: true };
  const karma = (extra: Record<string, unknown>) => ({ kind: "ARK_PASSIVE_POINT", tree: "깨달음", ...extra });
  assert.deepEqual(parseSimulateRequest(body(karma({ karmaLevel: 30 })), on)?.changes, [karma({ karmaLevel: 30 })]);
  assert.deepEqual(parseSimulateRequest(body(karma({ karmaLevel: 0 })), on)?.changes, [karma({ karmaLevel: 0 })]);
  // Refused as a whole request, never sent on without the level.
  const refused: [string, Record<string, unknown>, { karma?: boolean }?][] = [
    ["31", karma({ karmaLevel: 31 })],
    ["-1", karma({ karmaLevel: -1 })],
    ["not a whole number", karma({ karmaLevel: 2.5 })],
    ["a string", karma({ karmaLevel: "30" })],
    ["another tree (진화)", { kind: "ARK_PASSIVE_POINT", tree: "진화", karmaLevel: 3 }],
    ["no tree", { kind: "ARK_PASSIVE_POINT", karmaLevel: 3 }],
    ["with points", karma({ karmaLevel: 30, points: 101 })],
    ["with level", karma({ karmaLevel: 30, level: 1 })],
    ["another kind", { kind: "ENGRAVING_LEVEL", name: "원한", level: 3, karmaLevel: 3 }],
    ["KARMA_SIM off", karma({ karmaLevel: 30 }), { karma: false }],
    ["KARMA_SIM not given", karma({ karmaLevel: 30 }), {}],
  ];
  for (const [why, change, flag = on] of refused) assert.equal(parseSimulateRequest(body(change), flag), null, why);
  // Point changes without karmaLevel are as before, flag or not.
  assert.deepEqual(parseSimulateRequest(body({ kind: "ARK_PASSIVE_POINT", tree: "진화", points: 140 }))?.changes, [
    { kind: "ARK_PASSIVE_POINT", tree: "진화", points: 140 },
  ]);
});

test("the upstream request refuses a karma change unless KARMA_SIM is on", async () => {
  let sent = 0;
  const fetcher = (async () => {
    sent += 1;
    return new Response("{}", { status: 500 });
  }) as typeof fetch;
  const body = { characterName: "테스트", changes: [{ kind: "ARK_PASSIVE_POINT", tree: "깨달음", karmaLevel: 30 }] };
  const off = await requestSimulation(body, "http://api.test", { fetcher });
  assert.deepEqual(off, { ok: false, error: { code: "INVALID_REQUEST", status: 400 } });
  assert.equal(sent, 0);
  await requestSimulation(body, "http://api.test", { fetcher, karma: true });
  assert.equal(sent, 1);
});

test("a spec-up karma step opens in the simulator with its level; 깨달음 points still open nothing", () => {
  assert.deepEqual(editsFor(karmaChange(30), NO_EDITS)?.karma, { 깨달음: 30 });
  assert.equal(editsFor(karmaChange(31), NO_EDITS), null);
  assert.equal(editsFor({ kind: "ARK_PASSIVE_POINT", tree: "진화", karmaLevel: 3 } as SpecUpChange, NO_EDITS), null);
  assert.equal(editsFor({ kind: "ARK_PASSIVE_POINT", tree: "깨달음", points: 90 } as unknown as SpecUpChange, NO_EDITS), null);
  // ?try= keeps the tree and the level (dropped, the path would open without its karma step).
  assert.deepEqual(readTryPath(tryPathParam([karmaChange(30)])), [
    { kind: "ARK_PASSIVE_POINT", slot: null, index: null, level: null, refine: null, quality: null, name: null, tree: "깨달음", karmaLevel: 30 },
  ]);
  assert.equal(readTryPath(JSON.stringify([{ kind: "ARK_PASSIVE_POINT", tree: "깨달음", karmaLevel: 99 }]))[0].karmaLevel, undefined);
});

test("simulatorPath takes a karma step only where the simulator edits the karma level (KARMA_SIM)", () => {
  const gem = { change: { kind: "GEM_LEVEL", slot: 1, level: 9 } } as GoalStep;
  const karma = { change: karmaChange(30), changes: [karmaChange(30)] } as unknown as GoalStep;
  assert.deepEqual(simulatorPath([gem, karma], undefined, true), { changes: [gem.change, karmaChange(30)], skipped: 0 });
  assert.deepEqual(simulatorPath([gem, karma], undefined, false), { changes: [gem.change], skipped: 1 });
  assert.deepEqual(simulatorPath([gem, karma]), { changes: [gem.change], skipped: 1 });
});

test("a saved karma level comes back on the same 깨달음 tree only, inside 0~30", () => {
  const identity: Identity = { gems: [], gear: [], polish: [], bracelet: [], engravings: [], stones: [], arkPassive: [{ tree: "깨달음" }], cores: [] };
  const saved = parseSaved(JSON.stringify({ edits: { ...NO_EDITS, karma: { 깨달음: 30, 진화: 3 } }, savedAt: "x", targets: targetsOf(identity) }));
  assert.deepEqual(saved?.edits.karma, { 깨달음: 30 });
  assert.deepEqual(parseSaved(JSON.stringify({ edits: { ...NO_EDITS, karma: { 깨달음: 31 } }, savedAt: "x" }))?.edits.karma, {});
  // An older save has none.
  const old = Object.fromEntries(Object.entries(NO_EDITS).filter(([key]) => key !== "karma"));
  assert.deepEqual(parseSaved(JSON.stringify({ edits: old, savedAt: "x" }))?.edits.karma, {});
  const applied = applySaved(saved!, identity);
  assert.ok(!("legacy" in applied));
  assert.deepEqual(applied.edits.karma, { 깨달음: 30 });
  // A character without 깨달음 now: left out and counted.
  const other = applySaved(saved!, { ...identity, arkPassive: [{ tree: "진화" }] });
  assert.ok(!("legacy" in other));
  assert.deepEqual([other.edits.karma, other.skipped], [{}, 1]);
});

test("KARMA_SIM: on/off override; otherwise hidden on the production host only, and never without the simulator", () => {
  const prod = "https://loakraken.gg";
  assert.equal(isKarmaSimEnabled({ SITE_URL: prod }), false);
  assert.equal(isKarmaSimEnabled({ SITE_URL: prod, COMBAT_POWER_SIM: "on" }), false);
  assert.equal(isKarmaSimEnabled({ SITE_URL: prod, COMBAT_POWER_SIM: "on", KARMA_SIM: "on" }), true);
  assert.equal(isKarmaSimEnabled({ SITE_URL: "http://localhost:3000" }), true);
  assert.equal(isKarmaSimEnabled({ SITE_URL: "http://localhost:3000", KARMA_SIM: "off" }), false);
  assert.equal(isKarmaSimEnabled({ SITE_URL: "http://localhost:3000", COMBAT_POWER_SIM: "off", KARMA_SIM: "on" }), false);
});
