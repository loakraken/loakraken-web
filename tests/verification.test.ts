// Regression against the calc-verification team's samples (backend repo
// src/test/resources/verification, copied to tests/fixtures/verification —
// source commits in tests/fixtures/verification/README.md).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateAuction } from "../lib/tools/auction";
import {
  GOAL_PRESETS,
  LUCK_QUANTILES,
  createSolver,
  replay,
  stonesFor,
  totalSuccessDistribution,
  type Goal,
} from "../lib/tools/stone";

const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/verification/${path}`, import.meta.url), "utf8"));

test("auction bids match every verified case", () => {
  const sample = read("auction/iloa-loalab-2026-10-09.json");
  assert.ok(sample.cases.length >= 3);
  for (const c of sample.cases) {
    const r = calculateAuction(c.price, c.party);
    const bid = Object.fromEntries(r.strategies.map((s) => [s.id, s.bid]));
    const actual: Record<string, number> = {
      fee: r.fee,
      saleGold: r.saleGold,
      saleBreakEven: r.breakEven,
      useMyself: r.useMyself,
      preempt: bid.preempt,
      keep75: bid.keep75,
      keep50: bid.keep50,
      keep25: bid.keep25,
      breakEvenShare: r.breakEvenShare,
    };
    for (const [key, value] of Object.entries(c.expected as Record<string, number>))
      assert.equal(actual[key], value, `${c.price}/${c.party} ${key}`);
  }
});

test("stone chance rules reproduce the official total-success table", () => {
  const sample = read("ability-stone/official-iloa-2026-10-09.json");
  const tolerance = sample.tolerance.totalSuccessPctPoint;
  for (const [slots, official] of Object.entries(sample.officialTotalSuccessPct as Record<string, number[]>)) {
    const ours = totalSuccessDistribution(Number(slots)).map((p) => p * 100);
    assert.equal(ours.length, official.length, `${slots} slots`);
    ours.forEach((pct, s) =>
      assert.ok(Math.abs(pct - official[s]) <= tolerance, `${slots} slots, ${s} successes: ${pct} vs ${official[s]}`),
    );
  }
});

test("stone manual cases match ILOA within tolerance", () => {
  const sample = read("ability-stone/official-iloa-2026-10-09.json");
  const tolerance = sample.tolerance.manualPctPoint;
  const goals: Record<string, Goal> = {
    "10칸 77·감소≤4": GOAL_PRESETS.find((g) => g.id === "77")!,
    "10칸 97·79·10/6·6/10·감소≤4": GOAL_PRESETS.find((g) => g.id === "97")!,
  };
  for (const c of sample.manualCases) {
    const goal = goals[c.id];
    assert.ok(goal, `goal for ${c.id}`);
    const chance = createSolver(c.slots, 4, goal).at(replay(c.slots, []));
    assert.ok(Math.abs(chance * 100 - c.iloaPct) <= tolerance, `${c.id}: ${chance * 100}`);
    assert.ok(Math.abs(chance * 100 - c.computedPct) <= 0.001, `${c.id} computed`);
    assert.deepEqual(
      LUCK_QUANTILES.map(({ q }) => stonesFor(chance, q)),
      c.iloaStones,
      `${c.id} stones`,
    );
  }
});
