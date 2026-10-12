// 스펙업 목표 (checklist L31): reach a target combat power with the spec-up
// candidates taken in efficiency order. Each candidate's delta is measured
// alone from today's character, so deltas are never added up: the path is
// sent to the simulator as one change set and its own result decides
// whether the goal is met (no estimated totals, PM 총괄 데이터 규칙).
import type { Change } from "../combat-power/model";
import type { Candidate, SpecUpChange } from "./model";

/** The simulator change for a spec-up change, or null for kinds it does not take. */
export function simChange(change: SpecUpChange | null | undefined): Change | null {
  if (!change) return null;
  switch (change.kind) {
    case "GEM_LEVEL":
      return change.slot != null && change.level != null ? { kind: "GEM_LEVEL", slot: change.slot, level: change.level } : null;
    case "EQUIPMENT_QUALITY":
      return change.index != null && change.quality != null
        ? { kind: "EQUIPMENT_QUALITY", index: change.index, quality: change.quality }
        : null;
    case "ENGRAVING_LEVEL":
      return change.name && change.level != null ? { kind: "ENGRAVING_LEVEL", name: change.name, level: change.level } : null;
    case "STONE_ENGRAVING":
      return change.name && change.level != null ? { kind: "STONE_ENGRAVING", name: change.name, level: change.level } : null;
    default:
      return null;
  }
}

/** One edit per target: two steps on the same gem slot cannot both be taken. */
const targetKey = (change: Change) => {
  const c = change as Change & { slot?: number; index?: number; name?: string };
  return `${c.kind}:${c.slot ?? c.index ?? c.name ?? ""}`;
};

export type GoalStep = { candidate: Candidate; change: Change; cost: number };

/**
 * Candidates usable on the path, best efficiency first (the backend's
 * EFFICIENCY order): computed (OK), with a known gold cost and a change the
 * simulator takes; the first one per target wins.
 */
export function goalSteps(candidates: Candidate[]): GoalStep[] {
  const seen = new Set<string>();
  const steps: GoalStep[] = [];
  for (const candidate of candidates) {
    if (candidate.status !== "OK") continue;
    const cost = candidate.cost;
    if (!cost || cost.status !== "OK" || cost.unit !== "GOLD" || cost.amount == null) continue;
    const change = simChange(candidate.change);
    if (!change) continue;
    const key = targetKey(change);
    if (seen.has(key)) continue;
    seen.add(key);
    steps.push({ candidate, change, cost: cost.amount });
  }
  return steps;
}

export type GoalResult =
  /** The shortest prefix of `steps` whose simulated power reaches the goal. */
  | { kind: "REACHED"; count: number; power: number; cost: number }
  /** Every step together still falls short: how far all of them get. */
  | { kind: "SHORT"; count: number; power: number; cost: number }
  | { kind: "ALREADY"; power: number };

/**
 * Smallest k with simulate(first k changes) >= goal, by binary search over
 * k (more upgrades never lower the power). `simulate` returns the combat
 * power after the given changes.
 */
export async function searchGoal(
  steps: GoalStep[],
  current: number,
  goal: number,
  simulate: (changes: Change[]) => Promise<number>,
): Promise<GoalResult> {
  if (current >= goal) return { kind: "ALREADY", power: current };
  const costOf = (k: number) => steps.slice(0, k).reduce((sum, s) => sum + s.cost, 0);
  const powerAt = new Map<number, number>();
  const at = async (k: number) => {
    if (!powerAt.has(k)) powerAt.set(k, await simulate(steps.slice(0, k).map((s) => s.change)));
    return powerAt.get(k)!;
  };
  const all = steps.length;
  if (all === 0) return { kind: "SHORT", count: 0, power: current, cost: 0 };
  const top = await at(all);
  if (top < goal) return { kind: "SHORT", count: all, power: top, cost: costOf(all) };
  let lo = 1;
  let hi = all;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await at(mid)) >= goal) hi = mid;
    else lo = mid + 1;
  }
  return { kind: "REACHED", count: lo, power: await at(lo), cost: costOf(lo) };
}
