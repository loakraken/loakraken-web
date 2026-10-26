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
 * 404 that is not "character not found". The panel then says it is not open yet.
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

/** "실링 720,000 · 고통의 가시 15" — costs kept as quantities, never turned into gold (api #761); "" when none. */
export function nonGoldText(data: Receipt) {
  return (data.total.nonGold ?? [])
    .filter((q) => q.amount > 0)
    .map((q) => `${q.name} ${q.amount.toLocaleString("ko-KR")}`)
    .join(" · ");
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
    unavailableCount(data) > 0 ||
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
  const unavailable = unavailableCount(data);
  if (unavailable > 0) parts.push(`확인 못 함 ${unavailable}명`);
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
  if (row.status !== "READY") return null;
  if (row.complete === false) return { partial: true, text: "일부" };
  if (row.excluded.length > 0) return { partial: false, text: `제외 ${row.excluded.length}` };
  return null;
}

/**
 * Members the backend could not find this time (status UNAVAILABLE, api
 * receipt fan-out): left out of pending, so they are not asked for again.
 * coverage.unavailable when the backend sends it, else counted from the rows.
 */
export function unavailableCount(data: Receipt) {
  const rows = data.equipment.characters.filter((c) => memberState(c) === "UNAVAILABLE").length;
  // A status this screen does not know is never in coverage.unavailable.
  return Math.max(data.coverage.unavailable ?? 0, rows);
}

/**
 * READY or PENDING as sent; UNAVAILABLE and any status this screen does not
 * know read as "확인 못 함" (not counted, not asked for again), never a crash.
 */
export function memberState(row: ReceiptCharacter): "READY" | "PENDING" | "UNAVAILABLE" {
  return row.status === "READY" || row.status === "PENDING" ? row.status : "UNAVAILABLE";
}

/**
 * "원정대 14명 중 6명 계산 · 8명 갱신 중 · 1명 확인 못 함": "갱신 중" while
 * the panel is still filling members in by itself, "대기" once it stopped.
 */
export function coverageText(data: Receipt, refreshing = false) {
  const c = data.coverage;
  const parts = [`원정대 ${c.rosterCharacters}명 중 ${c.ready}명 계산`];
  if (c.pending > 0) parts.push(`${c.pending}명 ${refreshing ? "갱신 중" : "대기"}`);
  const unavailable = unavailableCount(data);
  if (unavailable > 0) parts.push(`${unavailable}명 확인 못 함`);
  return parts.join(" · ");
}

/** "5분 전 기준": how old the equipment used for a member is; null without a time. */
export function observedText(observedAt: string | null | undefined, now: number) {
  if (!observedAt) return null;
  const at = Date.parse(observedAt);
  if (!Number.isFinite(at)) return null;
  const minutes = Math.max(0, Math.floor((now - at) / 60_000));
  if (minutes < 1) return "방금 기준";
  if (minutes < 60) return `${minutes}분 전 기준`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}시간 전 기준` : `${Math.floor(hours / 24)}일 전 기준`;
}

/**
 * Never sooner than this between two refills: each spends up to 2 official
 * calls and a visitor may make 20 per minute (CLIENT_LIMIT_OFFICIAL), so
 * 2 per 6 s keeps the refill alone inside the limit even when the backend
 * says "now".
 */
export const REFILL_FLOOR_MS = 6_000;

/**
 * When to ask again by itself (receipt fan-out contract): only while members
 * are pending and it has not stopped; the backend's nextAvailableAt first
 * (now at the per-open cap, later when the visitor's budget or the official
 * limit needs it), and never sooner than REFILL_FLOOR_MS. null = do not ask
 * again by itself.
 */
export function nextRefreshDelay(data: Receipt, now: number, stopped: boolean): number | null {
  if (stopped || data.coverage.pending <= 0) return null;
  const at = data.coverage.nextAvailableAt ? Date.parse(data.coverage.nextAvailableAt) : now;
  return Math.max(REFILL_FLOOR_MS, (Number.isFinite(at) ? at : now) - now);
}
