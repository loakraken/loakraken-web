// M49 (api #1079, web #1935): 아크 그리드 젬 바꾸기 in the simulator. The gems a swap starts from (type from the name
// as the api reads it), the checks the api makes, the change that goes out, the proxy guard behind ARK_GEM_SIM, and
// saved swaps aimed at the gem they replace.
import assert from "node:assert/strict";
import test from "node:test";
import {
  GEM_OPTIONS,
  currentGems,
  gemEditError,
  gemKey,
  withGemType,
  type CurrentGem,
  type GemEdit,
} from "../lib/combat-power/ark-gems";
import { NO_EDITS, isCoreOpen, parseSimulateRequest, toChanges, type Current } from "../lib/combat-power/model";
import { applySaved, parseSaved, serializeSaved, type Identity } from "../lib/combat-power/history";

// The shape real data has (원본 2026-10-17 g01): '질서의 젬 : 안정', options 공격력 · 아군 피해 강화 …
const gem = (index: number, type: string, options: [string, number][], extra: Record<string, unknown> = {}) => ({
  index,
  active: true,
  name: `${type === "안정" || type === "견고" || type === "불변" ? "질서" : "혼돈"}의 젬 : ${type}`,
  gemPoint: 5,
  corePoint: 5,
  requiredWillpower: 4,
  willpowerEfficiency: 4,
  options: options.map(([name, level]) => ({ name, level })),
  ...extra,
});
const slots = [
  { index: 0, name: "질서의 해 코어 : 살상연희", gems: [gem(0, "안정", [["공격력", 1], ["아군 피해 강화", 1]]), gem(1, "견고", [["보스 피해", 3], ["공격력", 2]], { willpowerEfficiency: null, requiredWillpower: 6 })] },
  { index: 3, name: "혼돈의 별 코어 : 무기", gems: [gem(0, "침식", [["추가 피해", 5], ["공격력", 4]])] },
  { index: 4, name: "혼돈의 달 코어 : 불타는 일격", gems: [gem(0, "침식", [["추가 피해", 5], ["낙인력", 4]]), gem(1, "왜곡", [["공격력", 5]])] },
];

test("currentGems: type from the name, 의지력 효율 from the tooltip or base − required; the weapon core and half-read gems wait", () => {
  const gems = currentGems(slots, isCoreOpen);
  assert.deepEqual(
    gems.map((g) => [gemKey(g), g.series, g.edit.gemType, g.edit.willEfficiency]),
    [
      ["0:0", "질서", "안정", 4],
      ["0:1", "질서", "견고", 3],
      ["4:0", "혼돈", "침식", 4],
    ],
  );
});

const base: GemEdit = { gemType: "침식", willEfficiency: 4, point: 5, effects: [{ name: "추가 피해", level: 5 }, { name: "낙인력", level: 4 }] };

test("gemEditError: the api's own checks (type for the core, 1~5, two different options of the type)", () => {
  assert.equal(gemEditError(base, "혼돈"), null);
  assert.match(gemEditError({ ...base, gemType: "안정" }, "혼돈") ?? "", /혼돈 코어/);
  assert.match(gemEditError({ ...base, willEfficiency: 6 }, "혼돈") ?? "", /의지력 효율/);
  assert.match(gemEditError({ ...base, point: 0 }, "혼돈") ?? "", /포인트/);
  assert.match(gemEditError({ ...base, effects: [base.effects[0], { name: "보스 피해", level: 2 }] }, "혼돈") ?? "", /없는 옵션/);
  assert.match(gemEditError({ ...base, effects: [base.effects[0], { name: "추가 피해", level: 2 }] }, "혼돈") ?? "", /서로 달라야/);
  assert.match(gemEditError({ ...base, effects: [base.effects[0], { name: "낙인력", level: 9 }] }, "혼돈") ?? "", /옵션 레벨/);
});

test("withGemType keeps the options the new type rolls and fills the rest from its pool", () => {
  const next = withGemType(base, "붕괴");
  assert.deepEqual(next.effects.map((e) => e.name), ["추가 피해", "낙인력"]);
  const other = withGemType(base, "왜곡");
  assert.ok(other.effects.every((e) => GEM_OPTIONS["왜곡"].includes(e.name)));
  assert.notEqual(other.effects[0].name, other.effects[1].name);
  assert.equal(gemEditError(other, "혼돈"), null);
});

const current = (gems: CurrentGem[]): Current => ({ gems: [], gear: [], arkGems: gems });

test("toChanges: a swap goes out only when it differs from the gem worn and the api takes it", () => {
  const gems = currentGems(slots, isCoreOpen);
  const worn = gems[2];
  assert.deepEqual(toChanges({ ...NO_EDITS, arkGem: { "4:0": worn.edit } }, current(gems)), []);
  const swap: GemEdit = { ...worn.edit, gemType: "붕괴" };
  assert.deepEqual(toChanges({ ...NO_EDITS, arkGem: { "4:0": swap } }, current(gems)), [
    { kind: "ARK_GRID_GEM", slotIndex: 4, index: 0, gemType: "붕괴", willEfficiency: 4, point: 5, effects: [{ name: "추가 피해", level: 5 }, { name: "낙인력", level: 4 }] },
  ]);
  // Not one the api takes (a 질서 type in a 혼돈 core): nothing goes out.
  assert.deepEqual(toChanges({ ...NO_EDITS, arkGem: { "4:0": { ...swap, gemType: "안정" } } }, current(gems)), []);
});

const swapChange = { kind: "ARK_GRID_GEM", slotIndex: 4, index: 0, gemType: "붕괴", willEfficiency: 4, point: 5, effects: [{ name: "추가 피해", level: 5 }, { name: "낙인력", level: 4 }] };
const body = (change: Record<string, unknown>) => ({ characterName: "젬바꿈캐릭터", changes: [change] });

test("proxy guard: ARK_GRID_GEM only with ARK_GEM_SIM on, exactly its fields, 1~5 bounds", () => {
  assert.equal(parseSimulateRequest(body(swapChange)), null);
  assert.deepEqual(parseSimulateRequest(body(swapChange), { gem: true })?.changes, [swapChange]);
  assert.equal(parseSimulateRequest(body({ ...swapChange, grade: "유물" }), { gem: true }), null);
  assert.equal(parseSimulateRequest(body({ ...swapChange, gemType: "무지개" }), { gem: true }), null);
  assert.equal(parseSimulateRequest(body({ ...swapChange, willEfficiency: 0 }), { gem: true }), null);
  assert.equal(parseSimulateRequest(body({ ...swapChange, effects: [swapChange.effects[0]] }), { gem: true }), null);
  assert.equal(parseSimulateRequest(body({ ...swapChange, effects: [swapChange.effects[0], { name: "낙인력", level: 4, x: 1 }] }), { gem: true }), null);
  assert.equal(parseSimulateRequest(body({ ...swapChange, effects: [swapChange.effects[0], { name: "낙인력", level: 6 }] }), { gem: true }), null);
});

test("saved swaps come back only onto the same gem worn", () => {
  const gems = currentGems(slots, isCoreOpen);
  const identity = { gems: [], gear: [], polish: [], bracelet: [], engravings: [], stones: [], arkPassive: [], cores: [], arkGems: gems } satisfies Identity;
  const edits = { ...NO_EDITS, arkGem: { "4:0": { ...gems[2].edit, gemType: "붕괴" } } };
  const saved = parseSaved(serializeSaved(edits, new Date("2026-11-22T06:00:00Z"), identity))!;
  const same = applySaved(saved, identity);
  assert.ok(!("legacy" in same) && same.skipped === 0 && same.edits.arkGem["4:0"].gemType === "붕괴");
  // The gem was re-rolled since: another target, left out.
  const rerolled = { ...identity, arkGems: gems.map((g) => (gemKey(g) === "4:0" ? { ...g, edit: { ...g.edit, point: 4 } } : g)) };
  const moved = applySaved(saved, rerolled);
  assert.ok(!("legacy" in moved) && moved.skipped === 1 && !moved.edits.arkGem["4:0"]);
});
