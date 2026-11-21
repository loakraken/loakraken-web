// 연마 한꺼번에 (PM 총괄 11-21 18:28, X1): every polish line at one grade on its own option, or every line with no
// scoring option, in one edit (one 이전 step); the button pressed while every line is at it.
import assert from "node:assert/strict";
import test from "node:test";
import { NO_EDITS, POLISH_NONE, polishPreset, polishPresetOf, toChanges, type Current } from "../lib/combat-power/model";

// Two lines of one necklace, as the e2e mock: 추가 피해 중, 적에게 주는 피해 하; and a second accessory's line at 상.
const lines = [
  { index: 3, line: 0, option: "추가 피해", grade: "MID" as const, value: "+1.60%" },
  { index: 3, line: 1, option: "적에게 주는 피해", grade: "LOW" as const, value: "+0.55%" },
  { index: 4, line: 0, option: "공격력", grade: "HIGH" as const, value: "+390" },
];
const current = { gems: [], gear: [], polish: lines, bracelet: [], engravings: [], stones: [], arkPassive: [], cores: [] } as unknown as Current;
const polishChanges = (edits: typeof NO_EDITS) =>
  toChanges(edits, current).filter((change) => change.kind === "POLISH").map((c) => [c.index, c.line, c.option, c.grade ?? null]);

test("a grade preset sets every line's grade on its own option; a grade a line already wears sends nothing", () => {
  const high = polishPreset(NO_EDITS, lines, "HIGH");
  assert.deepEqual(polishChanges(high), [
    [3, 0, "추가 피해", "HIGH"],
    [3, 1, "적에게 주는 피해", "HIGH"],
  ]);
  assert.equal(polishPresetOf(high, lines), "HIGH");
  const low = polishPreset(high, lines, "LOW");
  assert.deepEqual(polishChanges(low), [
    [3, 0, "추가 피해", "LOW"],
    [4, 0, "공격력", "LOW"],
  ]);
  assert.equal(polishPresetOf(low, lines), "LOW");
});

test("POLISH_NONE makes every line a line with no scoring option; a grade preset after it brings back the worn options", () => {
  const none = polishPreset(polishPreset(NO_EDITS, lines, "HIGH"), lines, POLISH_NONE);
  assert.deepEqual(polishChanges(none), [
    [3, 0, POLISH_NONE, null],
    [3, 1, POLISH_NONE, null],
    [4, 0, POLISH_NONE, null],
  ]);
  assert.deepEqual(none.polish, {});
  assert.equal(polishPresetOf(none, lines), POLISH_NONE);
  const mid = polishPreset(none, lines, "MID");
  assert.deepEqual(mid.polishOption, {});
  assert.deepEqual(polishChanges(mid), [
    [3, 1, "적에게 주는 피해", "MID"],
    [4, 0, "공격력", "MID"],
  ]);
  assert.equal(polishPresetOf(mid, lines), "MID");
});

test("the pressed preset: none for mixed lines, nothing edited, a swapped option or no lines", () => {
  assert.equal(polishPresetOf(NO_EDITS, lines), null);
  assert.equal(polishPresetOf({ ...NO_EDITS, polish: { "3:0": "HIGH" } }, lines), null);
  // A spec-up 연마 step's other option on one line: not any preset.
  const swapped = { ...polishPreset(NO_EDITS, lines, "HIGH"), polishOption: { "3:0": "추가 피해 %" } };
  assert.equal(polishPresetOf({ ...swapped, polishOption: { "3:0": "치명타 적중률 %" } }, lines), null);
  assert.equal(polishPresetOf(NO_EDITS, []), null);
  // Every line already wears 상 with nothing edited: 모두 상 is pressed.
  const allHigh = lines.map((line) => ({ ...line, grade: "HIGH" as const }));
  assert.equal(polishPresetOf(NO_EDITS, allHigh), "HIGH");
});

test("edits outside the polish lines stay; only these lines' polish and options are replaced", () => {
  const other = { ...NO_EDITS, polish: { "9:0": "LOW" as const }, polishOption: { "9:1": POLISH_NONE }, engraving: { 원한: 4 } };
  const high = polishPreset(other, lines, "HIGH");
  assert.equal(high.polish["9:0"], "LOW");
  assert.equal(high.polishOption["9:1"], POLISH_NONE);
  assert.equal(high.engraving.원한, 4);
  const none = polishPreset(other, lines, POLISH_NONE);
  assert.equal(none.polish["9:0"], "LOW");
  assert.equal(none.polishOption["9:1"], POLISH_NONE);
});
