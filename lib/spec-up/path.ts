// 추천 순서 (api #794): with no target, the backend picks the best next step,
// applies it, measures again, up to 30 steps. Every step is the goal path's
// step (same costs, same simulator); a target may come back at a later step
// (PM 총괄 10-31 18:16: its own section, never grouped). The web only formats it.
import type { components } from "../api/spec-up-schema";
import type { GoalStep } from "./goal";

type Schemas = components["schemas"];
export type SpecUpPath = Schemas["SpecUpPathResponse"];
export type PathUnpriced = Schemas["SpecUpPathExcludedResponse"];
export type PathEnvelope = { code: string; message: string; data: SpecUpPath };

export type PathSort = "EFFICIENCY" | "DELTA";
export const PATH_SORTS: readonly { id: PathSort; label: string }[] = [
  { id: "EFFICIENCY", label: "1만 골드당 효율" },
  { id: "DELTA", label: "전투력 증가" },
];
export const isPathSort = (value: unknown): value is PathSort => value === "EFFICIENCY" || value === "DELTA";

/** Rows shown before "모두 보기". */
export const PATH_FIRST_ROWS = 10;

const gemSlot = (step: Pick<GoalStep, "kind" | "candidateId">) =>
  step.kind === "GEM_LEVEL" ? step.candidateId.split(":").slice(0, 2).join(":") : null;

/**
 * The gold each step adds to the total. The backend's extraCost when it sends
 * one (백엔드 2 10-31: their sum is cumulativeCost); before that, the same rule
 * from the step costs: a gem step's cost runs from today's gem, so it adds its
 * cost minus the same slot's last earlier step. null = not known (never 0).
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
    return before === null ? null : Math.max(own - before, 0);
  });
}
