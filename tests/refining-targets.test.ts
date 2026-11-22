import assert from "node:assert/strict";
import test from "node:test";
import { defaultPart, PARTS, targetItemLevel, type PartId, type PartState } from "../lib/refining/model";
import {
  bumpPicked,
  levelGain,
  raisable,
  slideTargets,
  sliderMax,
  sliderValue,
  spreadStages,
} from "../lib/refining/targets";

const make = (over: Partial<Record<PartId, Partial<PartState>>> = {}) =>
  Object.fromEntries(PARTS.map((part) => [part.id, { ...defaultPart(), ...over[part.id] }])) as Record<PartId, PartState>;
const targets = (parts: Record<PartId, PartState>) => PARTS.map((part) => parts[part.id].target);

test("slider range: the six item-level parts from their current stage to 25 (완갑 and excluded parts aside)", () => {
  // Default: every part at 18 → 7 stages each, six parts = 42 (완갑 is not in the item level).
  assert.equal(sliderMax(make()), 42);
  assert.equal(sliderMax(make({ weapon: { enabled: false } })), 35);
  assert.equal(sliderMax(make({ helmet: { current: 25, target: 25 } })), 35);
  assert.equal(sliderValue(make()), 0);
  assert.equal(sliderValue(make({ weapon: { target: 20 }, chest: { target: 19 } })), 3);
});

test("each slid stage is +5 on one of six parts: +5/6 to the average item level, as the page's own level line", () => {
  assert.equal(levelGain(6), 5);
  const parts = spreadStages(make(), 6);
  assert.equal(targetItemLevel(1700, parts), 1700 + levelGain(6));
});

test("spreadStages fills evenly from the lowest target, first part on a tie, and keeps 완갑 and excluded parts", () => {
  const start = make({ weapon: { current: 20, target: 20 }, armGuard: { current: 5, target: 9 }, shoulder: { enabled: false, target: 18 } });
  // Weapon 20, five armour parts 18 (shoulder excluded) → four armour parts get one each first.
  assert.deepEqual(targets(spreadStages(start, 4)), [20, 19, 19, 19, 19, 18, 9]);
  // Twelve: eight take the four armour parts to 20 (level with the weapon), the last four go to the first four of the five.
  assert.deepEqual(targets(spreadStages(start, 12)), [21, 21, 21, 21, 20, 18, 9]);
  // Back to 0: every slid part at its current stage again.
  assert.deepEqual(targets(spreadStages(spreadStages(start, 12), 0)), [20, 18, 18, 18, 18, 18, 9]);
  // Past the end: capped at 25 each.
  assert.deepEqual(targets(spreadStages(start, 999)), [25, 25, 25, 25, 25, 18, 9]);
  // The round trip: the slider reads back the stages it set.
  assert.equal(sliderValue(spreadStages(start, 12)), 12);
});

test("spreadStages moves only the difference: a target set higher by hand is never lowered by raising (codex P2 on #1922)", () => {
  // Weapon set to 25 by hand, the other five at 18: the slider reads 7.
  const set = make({ weapon: { target: 25 } });
  assert.equal(sliderValue(set), 7);
  // 7 → 8: one more stage, to the first lowest part; the weapon stays at 25 (it went back to 20 before).
  assert.deepEqual(targets(spreadStages(set, 8)), [25, 19, 18, 18, 18, 18, 18]);
  // Same value: nothing moves.
  assert.deepEqual(targets(spreadStages(set, 7)), targets(set));
  // Lowering below what is set takes from the highest target first (never under the current stage).
  assert.deepEqual(targets(spreadStages(spreadStages(set, 8), 3)), [20, 19, 18, 18, 18, 18, 18]);
  assert.deepEqual(targets(spreadStages(set, 0)), [18, 18, 18, 18, 18, 18, 18]);
});

test("고른 부위 +1: one stage over the target (never under the current stage), up to 25, excluded parts skipped", () => {
  const start = make({ weapon: { target: 24 }, helmet: { current: 25, target: 25 }, chest: { enabled: false }, armGuard: { current: 3, target: 3 } });
  const next = bumpPicked(start, ["weapon", "helmet", "chest", "pants", "armGuard"]);
  assert.deepEqual(targets(next), [25, 25, 18, 19, 18, 18, 4]);
  assert.deepEqual(raisable(start, ["weapon", "helmet", "chest", "pants"]), ["weapon", "pants"]);
  assert.deepEqual(raisable(next, ["weapon", "helmet"]), []);
});

test("slideTargets: a step back gives back the targets of that value, ties or not (#1929, codex P3 on #1922)", () => {
  // Weapon at 18, the other five at 19 (slider at 5). Step by step from each result, +1 then −1 ended at
  // 19/19/19/19/19/18 (the last part on the tie gave the stage back); from the run's base it comes back as it was.
  const start = make({
    helmet: { target: 19 },
    chest: { target: 19 },
    pants: { target: 19 },
    gloves: { target: 19 },
    shoulder: { target: 19 },
  });
  assert.deepEqual(targets(spreadStages(spreadStages(start, 6), 5)).slice(0, 6), [19, 19, 19, 19, 19, 18]);
  const up = slideTargets(null, start, 6);
  assert.deepEqual(targets(up.made).slice(0, 6), [19, 19, 19, 19, 19, 19]);
  const back = slideTargets(up, up.made, 5);
  assert.deepEqual(targets(back.made), targets(start));
  // Any path to a value ends at the same targets while the run lasts.
  let run = slideTargets(null, start, 9);
  run = slideTargets(run, run.made, 2);
  run = slideTargets(run, run.made, 7);
  assert.deepEqual(targets(run.made), targets(slideTargets(null, start, 7).made));
});

test("slideTargets starts a new run when the targets changed elsewhere ('고른 부위 +1', a row)", () => {
  const up = slideTargets(null, make(), 3);
  assert.deepEqual(targets(up.made), [19, 19, 19, 18, 18, 18, 18]);
  const bumped = bumpPicked(up.made, ["shoulder"]);
  const next = slideTargets(up, bumped, 5);
  // From the bumped parts, not the old base: the bumped shoulder keeps its stage, the extra one goes to the lowest.
  assert.equal(next.base, bumped);
  assert.deepEqual(targets(next.made), [19, 19, 19, 19, 18, 19, 18]);
});
