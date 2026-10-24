// Roster receipt (backend #174 receipt-v1, #208 assumeBook, #211 growth cost):
// the roster's gold value counting only verified items (equipment refining
// and tradable gems) at current prices. Every number is the backend's; this
// module only validates, labels and words it.

import type { components } from "../api/receipt-schema";

import { labelOf } from "../api/tolerant";

type Schemas = components["schemas"];
export type ReceiptEnvelope = Schemas["ApiResponseReceiptResponse"];
export type Receipt = Schemas["ReceiptResponse"];
export type ReceiptCharacter = Schemas["ReceiptCharacterResponse"];
export type ReceiptExcluded = Schemas["ReceiptExcludedResponse"];
export type ReceiptGem = Schemas["ReceiptGemResponse"];

/**
 * The receipt is off on this deployment (the backend route is not there): a
 * 404 that is not "character not found". The panel then stays out of the page.
 */
export const isReceiptOff = (error: { code: string; status: number } | null | undefined) =>
  error?.status === 404 && error.code !== "CHARACTER_NOT_FOUND";

export const KIND_LABEL: Record<string, string> = {
  EQUIPMENT: "장비 재련",
  GEM: "보석",
  ARK_GRID_GEM: "아크 그리드 젬",
  BRACELET: "팔찌",
  ACCESSORY: "장신구",
};
export const GRADE_LABEL: Record<string, string> = { UPHWA: "업화", JEONYUL: "전율" };
/** Short tags; the backend's own sentence (message) follows each one. */
export const EXCLUDED_LABEL: Record<string, string> = {
  UNSUPPORTED_GRADE: "산정하지 않는 등급",
  UNSUPPORTED_STAGE: "산정하지 않는 단계",
  ARM_GUARD: "완갑 제외",
  ADVANCED_REFINING: "상급 재련 미산정",
  PRICE_UNAVAILABLE: "시세 없음",
  GROWTH_COST_UNCONFIRMED: "성장 비용 미확정 단계 제외",
  /** Backend #236: limit-break steps have no confirmed cost yet. */
  LIMIT_BREAK_UNPRICED: "한계 해방 비용 미산정",
};
export const NOT_INCLUDED_REASON: Record<string, string> = { VERIFYING: "산정 기준 검증 중" };
export const GEM_STATUS: Record<string, string> = { NO_PRICE: "시세 없음", PENDING: "칸 확인 대기" };

export const kindLabel = (kind: string) => labelOf(KIND_LABEL, kind);
export const excludedLabel = (reason: string) => labelOf(EXCLUDED_LABEL, reason);

/** "장비 재련 · 보석" — what the total counts. */
export const includedText = (data: Receipt) => data.total.includedKinds.map(kindLabel).join(" · ");

/** "아크 그리드 젬 12 · 팔찌 5 · 장신구 25 (산정 기준 검증 중)" — what it leaves out (empty kinds dropped, PM #294). */
export function notIncludedText(data: Receipt) {
  const left = data.notIncluded.filter((n) => n.count > 0);
  if (!left.length) return "";
  const kinds = left.map((n) => `${kindLabel(n.kind)} ${n.count.toLocaleString("ko-KR")}`).join(" · ");
  const reasons = [...new Set(left.map((n) => labelOf(NOT_INCLUDED_REASON, n.reason)))].join(", ");
  return `${kinds} (${reasons})`;
}

/** "원정대 14명 중 6명 계산 · 8명 대기" while some characters are still pending. */
export function coverageText(data: Receipt) {
  const c = data.coverage;
  const head = `원정대 ${c.rosterCharacters}명 중 ${c.ready}명 계산`;
  return c.pending > 0 ? `${head} · ${c.pending}명 대기` : head;
}
