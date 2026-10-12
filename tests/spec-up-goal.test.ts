import assert from "node:assert/strict";
import test from "node:test";
import type { Change } from "../lib/combat-power/model";
import { goalSteps, searchGoal, simChange } from "../lib/spec-up/goal";
import type { Candidate } from "../lib/spec-up/model";

const candidate = (id: string, change: Candidate["change"], cost: number | null, status = "OK"): Candidate =>
  ({
    id,
    kind: change?.kind ?? "KARMA_LEVEL",
    target: id,
    status,
    change,
    cost: cost == null ? { unit: "GOLD", amount: null, status: "PENDING", code: "X", basis: "" } : { unit: "GOLD", amount: cost, status: "OK", code: "X", basis: "" },
  }) as Candidate;

const gem = (slot: number, level: number) => ({ kind: "GEM_LEVEL", slot, level, index: null, refine: null, quality: null, name: null });

test("only computed, priced, simulator-ready candidates join the path, one per target", () => {
  const steps = goalSteps([
    candidate("a", gem(3, 8), 1000),
    candidate("b", gem(3, 9), 2000), // same slot: the better one already taken
    candidate("c", gem(4, 8), null), // price pending
    candidate("d", { kind: "KARMA_LEVEL", slot: null, level: 5, index: null, refine: null, quality: null, name: null }, 500),
    candidate("e", gem(5, 8), 3000, "UNSUPPORTED"),
    candidate("f", { kind: "ENGRAVING_LEVEL", slot: null, level: 4, index: null, refine: null, quality: null, name: "원한" }, 4000),
  ]);
  assert.deepEqual(
    steps.map((s) => s.candidate.id),
    ["a", "f"],
  );
  assert.deepEqual(simChange(gem(3, 8)), { kind: "GEM_LEVEL", slot: 3, level: 8 });
});

// Fake simulator: each change adds 10, but together they add a bit less, so a
// sum of single deltas would overshoot (why the path is simulated as a whole).
const fake = (base: number) => async (changes: Change[]) => base + changes.length * 10 - (changes.length > 1 ? 1 : 0);

test("the shortest prefix whose simulated power reaches the goal, with its summed cost", async () => {
  const steps = goalSteps([1, 2, 3, 4, 5].map((slot) => candidate(`g${slot}`, gem(slot, 8), slot * 100)));
  const calls: number[] = [];
  const result = await searchGoal(steps, 1000, 1030, async (changes) => {
    calls.push(changes.length);
    return fake(1000)(changes);
  });
  // 3 changes → 1029 (short), 4 → 1039.
  assert.deepEqual(result, { kind: "REACHED", count: 4, power: 1039, cost: 100 + 200 + 300 + 400 });
  assert.ok(calls.length <= 4, `few simulator calls (${calls.length})`);
});

test("short when every step together falls short, already when the goal is met", async () => {
  const steps = goalSteps([candidate("g1", gem(1, 8), 100), candidate("g2", gem(2, 8), 200)]);
  assert.deepEqual(await searchGoal(steps, 1000, 2000, fake(1000)), { kind: "SHORT", count: 2, power: 1019, cost: 300 });
  assert.deepEqual(await searchGoal(steps, 1000, 900, fake(1000)), { kind: "ALREADY", power: 1000 });
  assert.deepEqual(await searchGoal([], 1000, 2000, fake(1000)), { kind: "SHORT", count: 0, power: 1000, cost: 0 });
});
