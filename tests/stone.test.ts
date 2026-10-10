import assert from "node:assert/strict";
import test from "node:test";
import {
  GOAL_PRESETS,
  LUCK_QUANTILES,
  advise,
  createSolver,
  decodeMoves,
  encodeMoves,
  formatChance,
  goalFromId,
  meetsGoal,
  recommendLine,
  replay,
  stonesFor,
  type Move,
} from "../lib/tools/stone";

const goal = (id: string) => GOAL_PRESETS.find((g) => g.id === id)!;
const fresh = () => replay(10, []);

test("new 10-slot stone matches ILOA and the calc team (decrease ≤ 4)", () => {
  const g77 = createSolver(10, 4, goal("77")).at(fresh());
  const g97 = createSolver(10, 4, goal("97")).at(fresh());
  assert.ok(Math.abs(g77 * 100 - 4.8145) < 0.001, `77 ${g77}`);
  assert.ok(Math.abs(g97 * 100 - 0.1356) < 0.0005, `97 ${g97}`);
  assert.equal(formatChance(g77), "4.8%");
  assert.equal(formatChance(g97), "0.14%");
});

test("stones needed follow the 25/50/90% quantiles ILOA shows", () => {
  const g77 = createSolver(10, 4, goal("77")).at(fresh());
  const g97 = createSolver(10, 4, goal("97")).at(fresh());
  const counts = (p: number) => LUCK_QUANTILES.map(({ q }) => stonesFor(p, q));
  assert.deepEqual(counts(g77), [6, 15, 47]);
  assert.deepEqual(counts(g97), [212, 511, 1697]);
  assert.equal(stonesFor(0, 0.5), null);
  assert.equal(stonesFor(1, 0.9), 1);
});

test("fresh stone advice ties both increase lines, like ILOA", () => {
  const solver = createSolver(10, 4, goal("77"));
  const advice = advise(solver, goal("77"), fresh());
  assert.deepEqual(advice.best, [0, 1]);
  assert.ok(Math.abs(advice.perLine[0]! - advice.chance) < 1e-6);
  // ILOA shows 2.9% (77) and 0.06% (97) for faceting the decrease line first.
  assert.equal(formatChance(advice.perLine[2]!), "2.9%");
  const g97 = advise(createSolver(10, 4, goal("97")), goal("97"), fresh());
  assert.equal(formatChance(g97.perLine[2]!), "0.06%");
});

test("mid-stone advice matches ILOA (inc1 ✓✓, inc2 ✗, dec ✗)", () => {
  const state = replay(10, decodeMoves(10, "1s1s2f3f"));
  const view = (id: string) => {
    const a = advise(createSolver(10, 4, goal(id)), goal(id), state);
    return { chance: formatChance(a.chance), lines: a.perLine.map((v) => formatChance(v!)), best: a.best };
  };
  assert.deepEqual(view("77"), { chance: "6.4%", lines: ["5.7%", "6.4%", "3.8%"], best: [1] });
  assert.deepEqual(view("97"), { chance: "0.21%", lines: ["0.21%", "0.19%", "0.09%"], best: [0] });
});

test("goals accept either order", () => {
  assert.equal(meetsGoal(goal("97"), 7, 9), true);
  assert.equal(meetsGoal(goal("97"), 6, 10), true);
  assert.equal(meetsGoal(goal("97"), 8, 8), false);
  assert.equal(meetsGoal(goal("77"), 7, 7), true);
});

test("finished stones are certain or impossible", () => {
  const solver = createSolver(6, 4, goal("66"));
  const all = (line: 0 | 1 | 2, success: boolean): Move[] =>
    Array.from({ length: 6 }, () => ({ line, success }));
  const won = replay(6, [...all(0, true), ...all(1, true), ...all(2, false)]);
  assert.equal(solver.at(won), 1);
  const lost = replay(6, [...all(0, true), ...all(1, false), ...all(2, false)]);
  assert.equal(solver.at(lost), 0);
  assert.equal(solver.ifNext(won, 0), null, "full lines have no advice");
});

test("decrease limit prunes: too many decrease hits make it impossible", () => {
  const solver = createSolver(10, 4, goal("77"));
  const moves: Move[] = Array.from({ length: 5 }, () => ({ line: 2, success: true }));
  assert.equal(solver.at(replay(10, moves)), 0);
  const free = createSolver(10, null, goal("77"));
  assert.ok(free.at(replay(10, moves)) > 0);
});

test("no limit is never worse than a strict limit", () => {
  for (const id of ["77", "97", "96"]) {
    const strict = createSolver(8, 4, goal(id)).at(replay(8, []));
    const loose = createSolver(8, null, goal(id)).at(replay(8, []));
    assert.ok(loose >= strict - 1e-7, id);
  }
});

test("chance moves 75 → 65 on success and back up on failure", () => {
  const state = replay(10, [
    { line: 0, success: true },
    { line: 0, success: true },
    { line: 1, success: false },
  ]);
  assert.equal(state.step, 4);
  const floor = replay(10, Array.from({ length: 8 }, () => ({ line: 0 as const, success: true })));
  assert.equal(floor.step, 0, "clamped at 25%");
  assert.throws(() => replay(6, Array.from({ length: 7 }, () => ({ line: 0 as const, success: true }))));
});

test("moves survive a URL round trip and junk is dropped", () => {
  const moves: Move[] = [
    { line: 0, success: true },
    { line: 2, success: false },
    { line: 1, success: true },
  ];
  assert.equal(encodeMoves(moves), "1s3f2s");
  assert.deepEqual(decodeMoves(10, "1s3f2s"), moves);
  assert.deepEqual(decodeMoves(10, "4s"), []);
  assert.deepEqual(decodeMoves(6, "1s1s1s1s1s1s1s"), [], "overfull line");
});

test("chance text stays readable at the extremes", () => {
  assert.equal(formatChance(0), "0%");
  assert.equal(formatChance(1), "100%");
  assert.equal(formatChance(0.00000005), "0.01% 미만");
  assert.equal(formatChance(0.25), "25.0%");
});

test("one recommended line: ties go to the lower number (돌파고 시안)", () => {
  const goal = goalFromId("77")!;
  const solver = createSolver(10, 4, goal);
  // Fresh stone: lines 1 and 2 tie, so line 1 is the single recommendation.
  const fresh = recommendLine(advise(solver, goal, replay(10, [])));
  assert.equal(fresh.line, 0);
  assert.equal(fresh.tie, true);
  // After 1s1s2f3f (e2e state) line 2 is strictly best.
  const state = replay(10, decodeMoves(10, "1s1s2f3f"));
  const a = advise(solver, goal, state);
  const pick = recommendLine(a);
  assert.equal(pick.line, 1);
  assert.equal(pick.tie, false);
  assert.ok(pick.othersBest !== null && pick.othersBest < a.perLine[1]!);
});
