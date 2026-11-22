// (ours, X3 part 2, web #1951) 상급 재련 on the 재련 계산기: one request per part to the refining api's advanced-plans
// (api #1091), one row per 10-stage band it crosses. The api solves expected values only (no per-band percentiles), so
// these rows join the page total as expected values in every mode, with a line saying so (프론트 OK 11-22).
// Materials and gold are valued the page's way: each band's expectedMaterials and expectedRefineGold at the page's
// price basis, never the api's expectedCostGold (its own basis).
import type { components } from "../api/refining-schema";
import type { Character } from "../character/model";
import { refiningFailureCopy, sumQuantities, PARTS, type Grade, type PartId, type PartState, type Quantity } from "./model";

type Schemas = components["schemas"];
export type AdvancedRequest = Schemas["AdvancedRefiningPlanRequest"];
export type AdvancedPlan = Schemas["AdvancedRefiningPlanResponse"];
export type AdvancedEnvelope = { code: string; message: string; data: AdvancedPlan };

/** 상급 재련 runs 0~40 in bands of 10 (the api's band unit). */
export const ADVANCED_MAX = 40;
export const ADVANCED_BAND = 10;

/** The parts with 상급 재련: weapon and armour (완갑 has none). */
export const ADVANCED_PARTS = PARTS.filter((part) => part.type !== "ARM_GUARD");
export type AdvancedPartId = Exclude<PartId, "armGuard">;
export type AdvancedStage = { current: number; target: number };
export type AdvancedStages = Record<AdvancedPartId, AdvancedStage>;

export const initialAdvanced = (): AdvancedStages =>
  Object.fromEntries(ADVANCED_PARTS.map((part) => [part.id, { current: 0, target: 0 }])) as AdvancedStages;

/**
 * Whether a part can have 상급 재련 on this page: in the plan and 업화. 전율 gear has none (the game's own sentence,
 * the simulator's NO_ADVANCED_REFINE); the api would answer REFINING_ADVANCED_UNCONFIRMED.
 */
export const hasAdvanced = (state: PartState) => state.enabled && state.grade === "UPHWA";
export const NO_ADVANCED_JEONYUL = "전율 장비에는 상급 재련이 없어요.";

/** Current 상급 재련 per part from the equipment tooltips (search advancedRefineLevel); null when not read. */
export function advancedFromCharacter(data: Character): Record<AdvancedPartId, number | null> {
  return Object.fromEntries(
    ADVANCED_PARTS.map((part) => {
      const level = data.loadout.equipment.find((e) => e.type === part.slot)?.detail?.advancedRefineLevel;
      return [part.id, typeof level === "number" && Number.isInteger(level) && level >= 0 && level <= ADVANCED_MAX ? level : null];
    }),
  ) as Record<AdvancedPartId, number | null>;
}

/** The next band boundary above a target: 0 → 10, 13 → 20, 20 → 30; 40 stays 40. */
export const nextBand = (target: number) =>
  Math.min(ADVANCED_MAX, Math.floor(target / ADVANCED_BAND) * ADVANCED_BAND + ADVANCED_BAND);

/** '고른 부위 상급 +10': each picked part with 상급 재련 moves its target to the next band boundary. */
export function bumpAdvanced(
  stages: AdvancedStages,
  parts: Record<PartId, PartState>,
  picked: readonly PartId[],
): AdvancedStages {
  const next = { ...stages };
  for (const part of ADVANCED_PARTS)
    if (picked.includes(part.id) && hasAdvanced(parts[part.id])) {
      const stage = stages[part.id];
      next[part.id] = { ...stage, target: nextBand(Math.max(stage.current, stage.target)) };
    }
  return next;
}

export const advancedRaisable = (stages: AdvancedStages, parts: Record<PartId, PartState>, picked: readonly PartId[]) =>
  ADVANCED_PARTS.some(
    (part) =>
      picked.includes(part.id) &&
      hasAdvanced(parts[part.id]) &&
      Math.max(stages[part.id].current, stages[part.id].target) < ADVANCED_MAX,
  );

/** One request per part that goes past its current stage. */
export function advancedRequests(stages: AdvancedStages, parts: Record<PartId, PartState>) {
  return ADVANCED_PARTS.flatMap((part) => {
    const state = parts[part.id];
    const { current, target } = stages[part.id];
    if (!hasAdvanced(state) || target <= current) return [];
    const request: AdvancedRequest = {
      grade: state.grade as Grade,
      equipmentType: part.type as AdvancedRequest["equipmentType"],
      fromStage: current,
      toStage: target,
    };
    return [{ part, request, key: JSON.stringify([request.grade, request.equipmentType, current, target]) }];
  });
}

const isInt = (value: unknown, min: number, max: number) =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/** Server-side allow-list before any backend call: 업화 only (전율 has none), weapon or armour, 0 ≤ from < to ≤ 40. */
export function parseAdvancedRequest(body: unknown): AdvancedRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (input.grade !== "UPHWA") return null;
  if (input.equipmentType !== "WEAPON" && input.equipmentType !== "ARMOR") return null;
  if (!isInt(input.fromStage, 0, ADVANCED_MAX - 1) || !isInt(input.toStage, 1, ADVANCED_MAX)) return null;
  if ((input.toStage as number) <= (input.fromStage as number)) return null;
  return { grade: "UPHWA", equipmentType: input.equipmentType, fromStage: input.fromStage as number, toStage: input.toStage as number };
}

/** The api's policy per turn type in our words; an unknown value shows its code (the contract). */
export function policyText(code: string | null | undefined): string | null {
  switch (code) {
    case null:
    case undefined:
      return null;
    case "NONE":
      return "안 씀";
    case "BREATH":
      return "숨결";
    case "BOOK":
      return "책";
    case "BOTH":
      return "숨결 · 책";
    default:
      return code;
  }
}

export type AdvancedBand = {
  from: number;
  to: number;
  turns: number;
  /** '일반 숨결 · 선조 숨결 · 책' — which turns use a breath or a book. */
  policy: string;
  growthSupport: boolean;
  materials: Quantity[];
  refineGold: number;
  silver: number | null;
  singleSource: boolean;
};

export type AdvancedPartPlan = {
  part: (typeof ADVANCED_PARTS)[number];
  bands: AdvancedBand[];
  temperingStages: number[];
  policyLimited: boolean;
  assumptions: string[];
};

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** The answer as the page reads it: numbers checked, nulls kept where the contract allows them. */
export function advancedView(part: (typeof ADVANCED_PARTS)[number], plan: AdvancedPlan): AdvancedPartPlan {
  const bands = (plan.bands ?? []).map((band): AdvancedBand => {
    const p = band.policy ?? {};
    const lines = [
      ["일반", policyText(p.normal)],
      ["선조", policyText(p.ancestor)],
      ["강화 선조", policyText(p.enhanced)],
    ].flatMap(([label, text]) => (text ? [`${label} ${text}`] : []));
    return {
      from: num(band.fromStage) ?? 0,
      to: num(band.toStage) ?? 0,
      turns: num(band.expectedTurns?.total) ?? 0,
      policy: lines.join(" · "),
      growthSupport: band.growthSupport === true,
      materials: (band.expectedMaterials ?? []).filter((item) => num(item.amount) != null),
      refineGold: num(band.expectedRefineGold) ?? 0,
      silver: num(band.expectedSilver),
      singleSource: band.singleSource === true,
    };
  });
  return {
    part,
    bands,
    temperingStages: (plan.temperingStages ?? []).filter((stage) => num(stage) != null),
    policyLimited: plan.policyLimited === true,
    assumptions: plan.assumptions ?? [],
  };
}

/** Every band's materials and refine gold, unrounded: what joins the page total. */
export function advancedTotal(plans: readonly AdvancedPartPlan[]) {
  const bands = plans.flatMap((plan) => plan.bands);
  return {
    materials: sumQuantities(bands.map((band) => band.materials)),
    gold: bands.reduce((sum, band) => sum + band.refineGold, 0),
    bandCount: bands.length,
  };
}
export type AdvancedTotal = ReturnType<typeof advancedTotal>;

type Summary = {
  materials: (Quantity & { expected: number })[];
  gold: number;
  rawGold: number;
  attempts: number;
  stageCount: number;
};

/**
 * The page's summary with the 상급 bands joined: materials merged by name and rounded up once (as summarize does),
 * refine gold added before rounding. Attempts and stages stay the 일반 plan's own (상급 turns are not attempts).
 */
export function joinAdvanced(summary: Summary, total: AdvancedTotal | null): Summary {
  if (!total || total.bandCount === 0) return summary;
  const raw = sumQuantities([summary.materials.map((item) => ({ name: item.name, amount: item.expected })), total.materials]);
  const rawGold = summary.rawGold + total.gold;
  return {
    ...summary,
    materials: raw.map((item) => ({ ...item, amount: Math.ceil(item.amount - 1e-9), expected: item.amount })),
    rawGold,
    gold: Math.max(0, Math.ceil(rawGold - 1e-9)),
  };
}

/** A band's value at the page's prices: refine gold + each material's expected amount × its unit price. */
export function bandValue(band: AdvancedBand, prices: readonly { name: string; status: string; unitPriceGold?: number | null }[] | null) {
  if (!prices) return null;
  let value = band.refineGold;
  let unpriced = false;
  for (const item of band.materials) {
    const price = prices.find((p) => p.name === item.name);
    if (price?.status === "PRICED" && price.unitPriceGold != null) value += item.amount * price.unitPriceGold;
    else unpriced = true;
  }
  return { value: Math.ceil(value - 1e-9), unpriced };
}

export function advancedFailureCopy(error: { code: string }) {
  switch (error.code) {
    case "REFINING_ADVANCED_UNCONFIRMED":
      return { title: "상급 재련은 계산하지 않음", text: "전율 장비에는 상급 재련이 없어 계산하지 않아요." };
    case "REFINING_PRICE_PENDING":
      return { title: "재료 시세를 모으고 있어요", text: "상급 재련은 재료 시세로 숨결·책 사용을 골라요. 1분쯤 뒤 다시 계산해 주세요." };
    case "INVALID_REQUEST":
      return { title: "상급 재련 단계를 확인해 주세요", text: "현재 단계는 0~39, 목표 단계는 현재보다 높은 40 이하로 골라 주세요." };
    default:
      return refiningFailureCopy(error);
  }
}
