// 스펙업 후보 줄 상세 (api #550, 이슈 #887): one candidate's market listing,
// refining materials and before/after stats, read when its row is opened.
// Types come from the contract (contracts/spec-up.openapi.json).
import type { components } from "../api/spec-up-schema";

type Schemas = components["schemas"];
export type SpecUpDetail = Schemas["SpecUpDetailResponse"];
export type DetailStat = Schemas["SpecUpStatResponse"];
export type DetailMaterial = Schemas["SpecUpMaterialResponse"];
export type DetailMarket = Schemas["SpecUpMarketResponse"];
export type DetailRefine = Schemas["SpecUpRefineResponse"];
export type DetailEnvelope = { code: string; message: string; data: SpecUpDetail };

/** One cache entry per character snapshot and candidate; prices refresh by the minute. */
export const specUpDetailQuery = (name: string, fetchedAt: string | null | undefined, candidateId: string) =>
  ["spec-up", "detail", name, fetchedAt ?? null, candidateId] as const;

/**
 * Materials plus the refining gold, null while any price is pending. The
 * server rounds the sum up into the row's cost, so the two can differ by less
 * than a gold.
 */
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

/**
 * Breath used for the cost (a newer value shows as it comes). OPTIMAL (api
 * #642): each attempt uses the breath count that makes the expected cost
 * least; MAX is what the backend sent before it.
 */
const BREATH = new Map([
  ["NONE", "숨결 안 씀"],
  ["OPTIMAL", "숨결 회차마다 최적"],
  ["MAX", "숨결 최대"],
]);
export const breathLabel = (breath: string | null | undefined) => (breath ? (BREATH.get(breath) ?? breath) : null);
