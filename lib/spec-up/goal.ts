// 스펙업 목표 (checklist L31, api #455): the backend walks the spec-up
// candidates in efficiency order — the same item may go up several steps —
// until the target combat power, and every combat power on the path is the
// simulator's (never a sum of single deltas). The web only formats it.
import { isOpen } from "../combat-power/model";
import type { components } from "../api/spec-up-schema";
import { editsFor, SPEC_UP_KIND_LABEL, type SpecUpChange } from "./model";
import { NO_EDITS } from "../combat-power/model";

type Schemas = components["schemas"];
export type Goal = Schemas["SpecUpGoalResponse"];
export type GoalStep = Schemas["SpecUpGoalStepResponse"];
export type GoalEnvelope = { code: string; message: string; data: Goal };

/** Step kinds the path may hold; a newer kind reads "기타 단계" (PM-프론트 10-12 20:28). */
const STEP_KIND_LABEL: Record<string, string> = {
  ...SPEC_UP_KIND_LABEL,
  EQUIPMENT_SUCCESSION: "계승",
};
export const stepKindLabel = (kind: string) => STEP_KIND_LABEL[kind] ?? "기타 단계";

/** Stop codes the screen words itself; any other code shows the backend's stopReason. */
export const PATH_STOPS = ["REACHED", "ALREADY_REACHED", "NO_CANDIDATE", "STEP_LIMIT", "TIME_LIMIT"] as const;

/**
 * The target as typed: "12,360" or "12360.5" → number; null when empty;
 * NaN when not a number with at most two decimals.
 */
export function parseTarget(text: string): number | null {
  const plain = text.replace(/[,\s]/g, "");
  if (!plain) return null;
  return /^\d+(\.\d{1,2})?$/.test(plain) ? Number(plain) : Number.NaN;
}

/**
 * Why a target cannot be asked for, or null when it can. Same rule as the
 * backend's 400s: above 0, at most two decimals, at most twice today's power.
 */
export function targetError(target: number | null, current: number | null): string | null {
  if (target === null) return null;
  if (Number.isNaN(target) || target <= 0) return "숫자만 입력해 주세요(소수 둘째 자리까지).";
  if (current != null && target > current * 2) return "목표는 지금 전투력의 2배까지 넣을 수 있어요.";
  return null;
}

/**
 * The goal answer whose gem steps cost from now to that level (api #592): each
 * is max(that level's lowest price − the current gem's, 0), worked out on its
 * own, so an unknown step leaves the others as they are.
 */
export const GOAL_FROM_NOW = "spec-up-goal-v2";

/** "62만G", "지금부터 260만G" (a gem step of a v2 answer), "추가 비용 없음" (0), "시세 준비 중" or "비용 미확인" for one step. */
export function stepCost(step: GoalStep, gold: (amount: number) => string, ruleVersion?: string | null): string {
  const cost = step.cost;
  const fromNow = ruleVersion === GOAL_FROM_NOW && step.kind === "GEM_LEVEL" ? "지금부터 " : "";
  if (cost.status === "OK" && cost.amount === 0) return "추가 비용 없음";
  if (cost.status === "OK" && cost.amount != null)
    return cost.unit === "GOLD" ? `${fromNow}${gold(cost.amount)}G` : `${cost.amount} ${cost.unit}`;
  return cost.status === "PENDING" ? "시세 준비 중" : "비용 미확인";
}

/**
 * The path as simulator input (시뮬레이터에서 열기): only the changes the
 * simulator takes today, in order; `skipped` counts the steps left out
 * (PM-프론트 10-12 20:28 — the /simulate proxy refuses kinds it does not know).
 */
export function simulatorPath(steps: GoalStep[]): { changes: SpecUpChange[]; skipped: number } {
  const changes: SpecUpChange[] = [];
  for (const step of steps) {
    const change = step.change as SpecUpChange;
    if (isOpen(change.kind as never) && editsFor(change, NO_EDITS)) changes.push(change);
  }
  return { changes, skipped: steps.length - changes.length };
}
