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

export type PathSort = "EFFICIENCY" | "DELTA" | "KRAKEN";
// Own words, not the list's sort buttons above ('전투력 효율 (1만G당)' · '전투력 증가'):
// two controls with one name on one screen read as the same control.
export const PATH_SORTS: readonly { id: PathSort; label: string }[] = [
  { id: "EFFICIENCY", label: "효율 우선" },
  { id: "DELTA", label: "전투력 우선" },
];
/**
 * 크라켄 점수 (서포터는 서포터 점수) order, api #967; shown only where the api says it runs (api #971).
 * Named for what the api ranks by, score per 100,000 gold, not the raw gain (PM 총괄 · PM-프론트
 * #1734 P2). Since api #993 (PM 총괄 11-19) steps with no rate, costing nothing more (extra cost
 * ≤ 0) or an unknown cost, come after the rated ones (SpecUpGoalService.krakenPreferred); before
 * it they came first. Same rule for dealers and supporters.
 */
export const PATH_KRAKEN_SORT = {
  id: "KRAKEN",
  label: "점수 효율",
  describe: "10만 골드당 점수가 많이 오르는 순서예요. 더 드는 비용이 없거나 비용을 모르는 단계는 그 뒤에 와요.",
} as const satisfies { id: PathSort; label: string; describe: string };
export const isPathSort = (value: unknown): value is PathSort =>
  value === "EFFICIENCY" || value === "DELTA" || value === "KRAKEN";

/**
 * The 추천 순서 rules on screen. KRAKEN only where the api says sort=KRAKEN really
 * runs for this character (supportOrderAvailable, api #971; the web never asks
 * to find out, 백엔드 11-15). A supporter has no combat-power order, so their
 * path is the score one or none at all.
 */
export function pathSortsFor(
  supportOrder: boolean,
  supporter: boolean,
): readonly { id: PathSort; label: string; describe?: string }[] {
  if (supporter) return supportOrder ? [PATH_KRAKEN_SORT] : [];
  return supportOrder ? [...PATH_SORTS, PATH_KRAKEN_SORT] : PATH_SORTS;
}

/**
 * Whose score formula an answer used: the api's own word (krakenScoreRole, api #971;
 * a string whose values may grow), else the web's position check (PM-프론트 P3 on #1731).
 */
export const scoredAsSupporter = (role: string | null | undefined, fallback: boolean) =>
  role === "SUPPORT" ? true : role === "DEALER" ? false : fallback;

/**
 * The figures a path is told in (api #967). A KRAKEN answer orders by the Kraken
 * score, so it is told in that score, as the list's KRAKEN view is; on a
 * supporter's KRAKEN path the combat power is null (no CP number on screen).
 * Every other answer is told in combat power, as before. The web does not ask
 * for sort=KRAKEN on the path yet (백엔드 11-15: only after this ships).
 */
export function pathFigures(
  path: Pick<SpecUpPath, "sort" | "combatPower" | "finalCombatPower" | "krakenScore" | "finalKrakenScore" | "krakenScoreRole">,
  /** The web's own position check, used only when the answer does not name its score role. */
  supporter: boolean,
) {
  const scored = path.sort === "KRAKEN";
  return {
    scored,
    /** The figure's name: the list's own words for the same score, by the answer's own role. */
    name: scored ? (scoredAsSupporter(path.krakenScoreRole, supporter) ? "서포터 점수" : "크라켄 점수") : "전투력",
    perGold: scored ? "10만G당 점수" : "1만G당 전투력",
    start: (scored ? path.krakenScore : path.combatPower) ?? null,
    final: (scored ? path.finalKrakenScore : path.finalCombatPower) ?? null,
  };
}

/** One step's gain, value after it and gain per gold, in the path's figure; null = not given. */
export function stepFigures(step: GoalStep, scored: boolean) {
  return scored
    ? { gain: step.deltaKrakenScore ?? null, after: step.krakenScoreAfter ?? null, perGold: step.krakenScorePer100kGold ?? null }
    : { gain: step.deltaCombatPower, after: step.combatPowerAfter, perGold: step.combatPowerPer10kGold };
}

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

/**
 * The fields api #993 adds beside totalCost: the gold of the steps whose cost is
 * known and how many steps have no cost. Optional here until the contract sync
 * after #993 merges; an api before it never sends them.
 */
type KnownCostParts = { knownCostTotal?: number | null; unknownCostSteps?: number | null };

/**
 * The path's total line (api #993, PM 총괄 11-19). KRAKEN and EFFICIENCY now add
 * the steps whose cost is unknown at the end, so totalCost is null on many paths.
 * Then the total is the known gold plus a count of the unknown steps; without
 * the new fields (an older api) it stays unknown, as before.
 * gold null = no total to show; unknownSteps 0 = nothing to add after it.
 */
export function pathTotal(path: SpecUpPath & KnownCostParts): { gold: number | null; unknownSteps: number } {
  if (path.totalCost != null) return { gold: path.totalCost, unknownSteps: 0 };
  const known = path.knownCostTotal;
  const unknown = path.unknownCostSteps;
  if (typeof known === "number" && Number.isFinite(known) && known >= 0 && Number.isInteger(unknown) && unknown! > 0)
    return { gold: known, unknownSteps: unknown! };
  return { gold: null, unknownSteps: 0 };
}
