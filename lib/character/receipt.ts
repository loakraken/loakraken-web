// Roster receipt (backend #174 receipt-v1, #208 assumeBook, #211 growth cost):
// the roster's gold value counting only verified items (equipment refining
// and tradable gems) at current prices. Every number is the backend's; this
// module only validates, labels and words it.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/receipt.openapi.json";
import type { components } from "../api/receipt-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { lazyValidator } from "../api/lazy-validator";
import { labelOf, tolerantSchemas } from "../api/tolerant";
import { characterNameError, normalizeCharacterName } from "./model";

type Schemas = components["schemas"];
export type ReceiptEnvelope = Schemas["ApiResponseReceiptResponse"];
export type Receipt = Schemas["ReceiptResponse"];
export type ReceiptCharacter = Schemas["ReceiptCharacterResponse"];
export type ReceiptExcluded = Schemas["ReceiptExcludedResponse"];
export type ReceiptGem = Schemas["ReceiptGemResponse"];

// Response enums loosened: a new reason or kind shows "알 수 없음", not an error page.
const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<ReceiptEnvelope>({
    $ref: "#/components/schemas/ApiResponseReceiptResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);
const isTime = (value: string) => Number.isFinite(Date.parse(value));

export function isReceiptEnvelope(value: unknown): value is ReceiptEnvelope {
  return validate(value) && value.code === "RECEIPT_SUCCESS" && isTime(value.data.computedAt);
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["CHARACTER_NOT_FOUND"],
  // Every 429 (CLIENT_RATE_LIMITED included) reads as the shared rate limit.
  429: ["LOST_ARK_RATE_LIMITED"],
  503: ["CHARACTER_CACHE_UNAVAILABLE", "MARKET_CACHE_UNAVAILABLE", "LOST_ARK_GATE_UNAVAILABLE"],
};
const invalid = { ok: false as const, error: { code: "INVALID_REQUEST", status: 400 } };

export function requestReceipt(
  name: string,
  assumeBook: boolean,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<ReceiptEnvelope>> {
  if (characterNameError(name)) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/receipt");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  // Always explicit (PM 총괄 10-11): if the backend default changes, "책 제외" still holds.
  url?.searchParams.set("assumeBook", String(assumeBook));
  return requestBackend(url, { ...options, isValid: isReceiptEnvelope, errorCodes });
}

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

export type TotalStatus = "COMPLETE" | "PARTIAL" | "UNAVAILABLE";

/**
 * How far the total can be trusted (backend #665 total.status): COMPLETE =
 * everything counted; PARTIAL = only what could be counted, so the real sum
 * is larger; UNAVAILABLE = something is missing and nothing was counted, so
 * there is no amount to show (never "0G"). Without the field (a backend from
 * before #665) or with a value this screen does not know, it is worked out
 * from the same facts the backend uses, erring on the side of "partial".
 */
export function totalStatus(data: Receipt): TotalStatus {
  const status = data.total.status;
  if (status === "COMPLETE" || status === "PARTIAL" || status === "UNAVAILABLE") return status;
  const missing =
    status != null ||
    data.coverage.pending > 0 ||
    data.gems.unpriced > 0 ||
    data.equipment.characters.some((c) => c.complete === false);
  if (!missing) return "COMPLETE";
  return data.total.gold > 0 ? "PARTIAL" : "UNAVAILABLE";
}

/**
 * "계산 대기 2명 · 시세 없음 3 · 완갑 제외 8 · 보석 환산 못 함 1개": what the
 * total leaves out and why, summed over the roster (counts per reason, in
 * the order the reasons first appear). Empty when nothing is left out.
 */
export function excludedSummary(data: Receipt) {
  const parts: string[] = [];
  if (data.coverage.pending > 0) parts.push(`계산 대기 ${data.coverage.pending}명`);
  const counts = new Map<string, number>();
  for (const row of data.equipment.characters)
    for (const item of row.excluded) counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1);
  for (const [reason, n] of counts) parts.push(`${excludedLabel(reason)} ${n.toLocaleString("ko-KR")}`);
  if (data.gems.unpriced > 0) parts.push(`보석 환산 못 함 ${data.gems.unpriced}개`);
  return parts.join(" · ");
}

/**
 * Row marker: "일부" when the backend says this character was only partly
 * counted (complete = false), "제외 N" when it counted everything it prices
 * but left parts out by rule; null otherwise (and while pending).
 */
export function rowMarker(row: ReceiptCharacter): { partial: boolean; text: string } | null {
  if (row.status === "PENDING") return null;
  if (row.complete === false) return { partial: true, text: "일부" };
  if (row.excluded.length > 0) return { partial: false, text: `제외 ${row.excluded.length}` };
  return null;
}

/** "원정대 14명 중 6명 계산 · 8명 대기" while some characters are still pending. */
export function coverageText(data: Receipt) {
  const c = data.coverage;
  const head = `원정대 ${c.rosterCharacters}명 중 ${c.ready}명 계산`;
  return c.pending > 0 ? `${head} · ${c.pending}명 대기` : head;
}
