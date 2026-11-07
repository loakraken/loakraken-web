// 추천 순서 (api #794): with no target, the backend picks the best next step,
// applies it, measures again, up to 30 steps. Every step is the goal path's
// step (same costs, same simulator); a target may come back at a later step.
// Since 11-02 (사용자 결정 layout A) it is the first chip of the spec-up list and
// its rows are the list's rows: a target's later steps fold under its first one.
// The web only formats it.
import type { components } from "../api/spec-up-schema";
import type { GoalStep } from "./goal";
import type { Candidate } from "./model";

type Schemas = components["schemas"];
export type SpecUpPath = Schemas["SpecUpPathResponse"];
export type PathUnpriced = Schemas["SpecUpPathExcludedResponse"];
export type PathEnvelope = { code: string; message: string; data: SpecUpPath };

export type PathSort = "EFFICIENCY" | "DELTA";
// Own words, not the list's sort buttons above ('1만 골드당 효율' · '전투력 증가'):
// two controls with one name on one screen read as the same control.
export const PATH_SORTS: readonly { id: PathSort; label: string }[] = [
  { id: "EFFICIENCY", label: "효율 우선" },
  { id: "DELTA", label: "전투력 우선" },
];
export const isPathSort = (value: unknown): value is PathSort => value === "EFFICIENCY" || value === "DELTA";

/** Rows shown before "모두 보기". */
export const PATH_FIRST_ROWS = 10;

const gemSlot = (step: Pick<GoalStep, "kind" | "candidateId">) =>
  step.kind === "GEM_LEVEL" ? step.candidateId.split(":").slice(0, 2).join(":") : null;

/**
 * A step as a spec-up list row (image, detail, same-target grouping): the
 * candidate the backend names by the same id, with this step's own figures.
 */
export function stepCandidate(step: GoalStep): Candidate {
  return {
    id: step.candidateId,
    kind: step.kind,
    target: step.target,
    from: step.from,
    to: step.to,
    icon: step.icon,
    grade: step.grade,
    skillName: step.skillName,
    suggestedTo: null,
    change: step.change,
    status: "OK",
    deltaCombatPower: step.deltaCombatPower,
    deltaPercent: null,
    cost: step.cost,
    combatPowerPer10kGold: step.combatPowerPer10kGold,
    reasonCode: null,
    reason: null,
    reasonDetail: null,
  };
}

/**
 * The gold each step adds to the total: the backend's extraCost (api #794
 * @bde1ae4; their sum is cumulativeCost). A goal answer from an api before it
 * gets the same rule from the step costs: a gem step's cost runs from today's
 * gem, so it adds its cost minus the same slot's last earlier step (0 or less
 * when prices run backwards). null = not known (never 0).
 */
export function extraCosts(steps: readonly GoalStep[]): (number | null)[] {
  const lastBySlot = new Map<string, number | null>();
  return steps.map((step) => {
    const slot = gemSlot(step);
    const own = step.cost.status === "OK" && step.cost.unit === "GOLD" ? (step.cost.amount ?? null) : null;
    const before = slot ? lastBySlot.get(slot) : undefined;
    if (slot) lastBySlot.set(slot, own);
    if (step.extraCost !== undefined) return step.extraCost;
    if (own === null) return null;
    if (before === undefined) return own;
    return before === null ? null : own - before;
  });
}
