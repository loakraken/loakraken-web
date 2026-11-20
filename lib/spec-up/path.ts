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
 * The path's total line (api #993, PM 총괄 11-19). KRAKEN and EFFICIENCY now add
 * the steps whose cost is unknown at the end, so totalCost is null on many paths.
 * Then the total is the known gold (knownCostTotal) plus a count of the unknown
 * steps (unknownCostSteps); when every step's cost is unknown there is no gold to
 * show, only the count (never 0G, PM 총괄 11-19). Both fields are optional in the
 * contract (deploy order): without them (an older api) it stays unknown, as before,
 * and a value that cannot be a count or an amount never makes a total up.
 * gold null = no total to show; unknownSteps 0 = no count to show.
 */
export function pathTotal(path: SpecUpPath): { gold: number | null; unknownSteps: number } {
  if (path.totalCost != null) return { gold: path.totalCost, unknownSteps: 0 };
  const known = path.knownCostTotal;
  const unknown = path.unknownCostSteps;
  if (typeof known === "number" && Number.isFinite(known) && known >= 0 && Number.isInteger(unknown) && unknown! > 0)
    return { gold: unknown! >= path.steps.length ? null : known, unknownSteps: unknown! };
  return { gold: null, unknownSteps: 0 };
}

/**
 * The path rules whose step costs pathCostNote describes (api SpecUpGoalService.PATH_RULE_VERSION). v7 (api #1019,
 * level jumps) keeps v6's paidCost and marginal; a 효율 우선 or 점수 효율 step can raise several levels at once, its
 * cost the whole range (rangeCost: refine and arm guard the sum of the stages, an engraving the book cost × levels,
 * a gem its target level's price as before). Accepted before #1019 ships (PM-프론트 11-20 22:53).
 */
export const PATH_COST_RULES: ReadonlySet<string> = new Set(["spec-up-path-v6", "spec-up-path-v7"]);
const JUMPS_RULE = "spec-up-path-v7";

/**
 * The note under the path on how its step costs were counted, per order (PM 총괄 11-20 P1; api #993,
 * SpecUpGoalService.paidCost / marginal). 효율 우선 and 점수 효율 (KRAKEN) pay each step: a tradeable gem or accessory
 * costs its new price less the price paid in the same slot the step before (never below 0), while a bound gem, a gem
 * for an empty slot, an accessory that cannot be traded and an ability stone cost their whole new price every time.
 * 전투력 우선 (DELTA) adds each step's cost less the same slot's step before for a gem, an ability stone and an
 * accessory (polish) step (marginal, slotCost); accessories are named only when the answer has a polish step.
 * Only an answer on that rule and one of those orders gets the per-step sentence (PM-프론트 #1793 P3): an answer
 * from another rule version or an order the web does not know says only what a step cost means.
 */
export function pathCostNote(path: Pick<SpecUpPath, "sort" | "ruleVersion" | "steps">): string {
  const plain = "비용은 그 단계에서 더 드는 골드예요.";
  if (!PATH_COST_RULES.has(path.ruleVersion)) return plain;
  // 전투력 우선 raises one level per step on every rule (api #1019 leaves DELTA at +1).
  if (path.sort === "DELTA") {
    const polish = path.steps.some((step) => step.kind === "POLISH");
    return `비용은 그 단계에서 더 드는 골드이고, 보석·어빌리티 ${polish ? "스톤·장신구는" : "스톤은"} 같은 칸의 앞 단계 비용을 빼고 셌어요.`;
  }
  if (path.sort === "EFFICIENCY" || path.sort === "KRAKEN") {
    const jumps = path.ruleVersion === JUMPS_RULE ? " 한 단계에 여러 레벨을 올리면 그 레벨까지 드는 비용을 한 번에 셌어요." : "";
    return `${plain} 거래할 수 있는 보석·장신구는 같은 칸의 앞 단계 값을 빼고, 귀속 보석·빈 칸 보석·거래할 수 없는 장신구·어빌리티 스톤은 단계마다 새 값을 다 셌어요.${jumps}`;
  }
  return plain;
}

/**
 * Why combat power stops, by the api's code (api #1029): words the web vouches for; another code gets none. A Map, so a
 * code that names an Object.prototype member ('__proto__', 'toString') is just an unknown code (codex #1835 P3).
 */
const CP_STOP_REASONS: ReadonlyMap<string, string> = new Map([
  ["ARMOR_REFINE_CP_UNCONFIRMED", "방어구·팔 보호구 재련은 전투력 계산식을 아직 확인하고 있어요. 점수와 비용은 그대로 셌어요."],
]);

/**
 * The note on where a path stops giving combat power (api #1029, 백엔드 11-21): a dealer's 점수 효율 path takes armor
 * refine and arm guard steps by score, and from the first of them on (combatPowerStopOrder) the api leaves the steps'
 * combat power out (null; a step's detail and the simulator show '—') while score and cost stay. null when the answer
 * has no stop (null, absent: an api before #1029) or names a step the path does not have.
 */
export function pathCpStopNote(
  path: Pick<SpecUpPath, "steps" | "combatPowerStopOrder" | "combatPowerStopReasonCode">,
): string | null {
  const order = path.combatPowerStopOrder;
  if (order == null || !Number.isInteger(order) || order < 1 || order > path.steps.length) return null;
  const where = order === 1 ? "이 순서는 첫 단계부터 전투력을 계산하지 않았어요." : `${order}단계부터는 전투력을 계산하지 않았어요.`;
  const why = CP_STOP_REASONS.get(path.combatPowerStopReasonCode ?? "");
  return why ? `${where} ${why}` : where;
}

/** Kinds every path takes; the lead line above the answer names only these (it shows before any answer). */
export const PATH_SCOPE_LEAD = "보석·재련·상급 재련·품질·각인·완갑·어빌리티 스톤 단계를 다뤄요.";

/**
 * The answer's switch fields (백엔드 11-21, v0.3.15; optional): whether this answer took 장신구 연마 / 깨달음 카르마 steps
 * into account. Local until the contract sync after the api PR, then this type goes and the schema's fields are read.
 */
export type PathScopeFields = { polishStepsConsidered?: boolean | null; karmaStepsConsidered?: boolean | null };

/** The two switch-gated kinds: the answer's field, the step kind that shows one in the path, and its name. */
const SCOPE_KINDS = [
  { field: "polishStepsConsidered", step: "POLISH", name: "장신구 연마" },
  { field: "karmaStepsConsidered", step: "KARMA_LEVEL", name: "깨달음 카르마" },
] as const;

/**
 * What this answer says about 장신구 연마 and 깨달음 카르마 steps (PM 총괄 11-21 05:42). Each joins the path only behind its
 * own api switch (spec-up.polish-path.enabled, api #951; spec-up.karma-cp.enabled, api #1004), both off on production,
 * and the answer says whether it was on (polishStepsConsidered / karmaStepsConsidered; for karma the role must take it).
 * Per kind: (c) on and a step of it in the answer → covered; (b) on and none in the answer (karma already at 30, none
 * worth it) → nothing; (a) off, which is anything but true, a missing field (an api before them) included → '… 단계는
 * 아직 추천 순서에 넣지 않아요.' naming only the kinds that are off, with no reason (both are switch-gated now, so the old
 * reasons no longer hold). null when there is nothing to say (no element on screen).
 */
export function pathScopeNote(path: Pick<SpecUpPath, "steps"> & PathScopeFields): string | null {
  const on = (kind: (typeof SCOPE_KINDS)[number]) => path[kind.field] === true;
  const covered = SCOPE_KINDS.filter((kind) => on(kind) && path.steps.some((step) => step.kind === kind.step));
  // 깨달음 카르마 first in the 'not yet' sentence, as PM 총괄 worded it.
  const off = SCOPE_KINDS.filter((kind) => !on(kind)).reverse();
  const parts = [
    covered.length > 0 ? `이 순서는 ${covered.map((kind) => kind.name).join("·")} 단계도 다뤄요.` : null,
    off.length > 0 ? `${off.map((kind) => kind.name).join(" · ")} 단계는 아직 추천 순서에 넣지 않아요.` : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(" ") : null;
}
