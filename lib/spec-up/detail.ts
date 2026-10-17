// 스펙업 후보 줄 상세 (백엔드 2 설계 10-18, 이슈 #887): one candidate's market
// listing, refining materials and before/after stats, read when its row is
// opened. Names follow the agreed design; the contract PR's generated types
// replace this draft (new fields stay optional until the api ships).
import type { Candidate } from "./model";

export type DetailStat = { name: string; before: number | string | null; after: number | string | null; unit: string | null };
export type DetailMaterial = {
  itemName: string;
  icon: string | null;
  /** Expected count, two decimals. */
  quantity: number;
  /** Gold for one; null when the price is not known yet. */
  unitPrice: number | null;
  gold: number | null;
  /** OK · PENDING · UNKNOWN (a newer value reads as UNKNOWN). */
  priceStatus: string;
  priceBasis: string | null;
};
export type DetailMarket = {
  itemName: string;
  icon: string | null;
  grade: string | null;
  price: number | null;
  listedCount: number | null;
  observedAt: string | null;
};
export type DetailRefine = { fromStage: number; toStage: number };
export type SpecUpDetail = {
  candidate: Candidate;
  pricesAt: string | null;
  combatPowerBefore: number | null;
  combatPowerAfter: number | null;
  stats: DetailStat[];
  materials: DetailMaterial[] | null;
  goldFee: number | null;
  market: DetailMarket[] | null;
  refine?: DetailRefine | null;
};
export type DetailEnvelope = { code: string; message: string; data: SpecUpDetail };

/** One cache entry per character snapshot and candidate; prices refresh by the minute. */
export const specUpDetailQuery = (name: string, fetchedAt: string | null | undefined, candidateId: string) =>
  ["spec-up", "detail", name, fetchedAt ?? null, candidateId] as const;

/** Materials plus the refining gold: the server keeps this equal to the row's cost (1 gold rounding). */
export function materialsTotal(detail: SpecUpDetail): number | null {
  if (!detail.materials?.length) return null;
  let sum = detail.goldFee ?? 0;
  for (const line of detail.materials) {
    if (line.gold == null) return null;
    sum += line.gold;
  }
  return sum;
}

/**
 * The refining planner with this character loaded (it reads only ?character=;
 * the steps are picked there). Only for candidates that have a refine step.
 */
export function refiningLink(characterName: string, refine: DetailRefine | null | undefined): string | null {
  if (!refine) return null;
  return `/tools/refining?${new URLSearchParams({ character: characterName })}`;
}

const num = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v));
const str = (v: unknown) => v === null || typeof v === "string";
const list = (v: unknown, each: (x: Record<string, unknown>) => boolean) =>
  v === null || v === undefined || (Array.isArray(v) && v.every((x) => x && typeof x === "object" && each(x)));

/**
 * The fields the screen reads, checked before use. The contract PR swaps this
 * for the shared schema validator (tolerant of new fields and values).
 */
export function isDetailEnvelope(value: unknown): value is DetailEnvelope {
  if (!value || typeof value !== "object") return false;
  const { code, data } = value as { code?: unknown; data?: Record<string, unknown> };
  if (code !== "SPEC_UP_DETAIL_SUCCESS" || !data || typeof data !== "object") return false;
  const candidate = data.candidate as Record<string, unknown> | undefined;
  if (!candidate || typeof candidate.id !== "string" || typeof candidate.target !== "string") return false;
  return (
    str(data.pricesAt ?? null) &&
    num(data.combatPowerBefore ?? null) &&
    num(data.combatPowerAfter ?? null) &&
    num(data.goldFee ?? null) &&
    list(data.stats ?? [], (s) => typeof s.name === "string") &&
    list(data.materials, (m) => typeof m.itemName === "string" && typeof m.quantity === "number" && num(m.unitPrice) && num(m.gold)) &&
    list(data.market, (m) => typeof m.itemName === "string" && num(m.price ?? null))
  );
}
