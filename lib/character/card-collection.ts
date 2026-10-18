// Roster card records (F-6): the best card set each element slot has reached
// on any character of the same-server roster ("원정대 카드 기록"), plus the
// 도감 (best awakening per card) and 장착 효과 (buildable sets).
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/card-collection.openapi.json";
import type { components } from "../api/card-collection-schema";
import { labelOf, tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { continueText, minutesUntil } from "./continue-later";

type Schemas = components["schemas"];
export type CardCollectionEnvelope = Schemas["ApiResponseCardCollectionResponse"];
export type CardCollection = Schemas["CardCollectionResponse"];
export type ElementSlot = Schemas["CardCollectionElementSlotResponse"];
export type RecordedCard = Schemas["CardCollectionCardResponse"];
export type BuildableSet = Schemas["CardCollectionSetResponse"];
export type Element = ElementSlot["element"];

export const ELEMENTS: readonly Element[] = ["LIGHT", "DARK", "LIGHTNING", "EARTH", "WATER", "FIRE"];
export const ELEMENT_LABEL: Record<Element, string> = {
  LIGHT: "성",
  DARK: "암",
  LIGHTNING: "뇌",
  EARTH: "토",
  WATER: "수",
  FIRE: "화",
};

// The backend's generated OpenAPI (#102) is also the runtime shape contract,
// with response enums loosened (#125): an unknown element shows as unknown.
const validate = lazyValidator(() => new Ajv2020({ strict: false, validateFormats: false }).compile<CardCollectionEnvelope>({
  $ref: "#/components/schemas/ApiResponseCardCollectionResponse",
  components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
}));
const isTime = (value: string) => Number.isFinite(Date.parse(value));

export function isCardCollectionEnvelope(value: unknown): value is CardCollectionEnvelope {
  if (!validate(value) || value.code !== "CHARACTER_CARD_COLLECTION_SUCCESS") return false;
  const d = value.data;
  return (
    [...d.elementRecords.dealer, ...d.elementRecords.supporter].every(
      (slot) => !slot.record || isTime(slot.record.observedAt),
    ) &&
    d.cards.every((card) => isTime(card.observedAt)) &&
    d.sets.every((set) => isTime(set.observedAt))
  );
}

/** Effect stage shown under the awakening total, only when it is lower. */
export function appliedStage(record: { awakening: number; activeAwakening: number | null }) {
  return record.activeAwakening != null && record.activeAwakening < record.awakening
    ? record.activeAwakening
    : null;
}

/** Element name (성·암·뇌·토·수·화), or "알 수 없음" for one this build does not know. */
export const elementLabel = (element: string) => labelOf(ELEMENT_LABEL, element);

/** Slots in 성·암·뇌·토·수·화 order whatever order they arrive in; unknown elements last. */
export function orderedSlots(slots: ElementSlot[]) {
  const rank = (element: string) => {
    const i = (ELEMENTS as readonly string[]).indexOf(element);
    return i < 0 ? ELEMENTS.length : i;
  };
  return [...slots].sort((a, b) => rank(a.element) - rank(b.element));
}

/** The six element slots for the character's role (supporters see 서폿 sets). */
export function slotsFor(data: CardCollection) {
  return orderedSlots(
    data.position === "SUPPORT" ? data.elementRecords.supporter : data.elementRecords.dealer,
  );
}

const GRADE_ORDER = ["고대", "유물", "전설", "영웅", "희귀", "고급", "일반"];
/** 도감 order: grade, then awakening, then name. */
export function sortCards(cards: RecordedCard[]) {
  const rank = (grade: string | null) => {
    const i = GRADE_ORDER.indexOf(grade ?? "");
    return i < 0 ? GRADE_ORDER.length : i;
  };
  return [...cards].sort(
    (a, b) => rank(a.grade) - rank(b.grade) || b.awakeCount - a.awakeCount || a.name.localeCompare(b.name, "ko"),
  );
}

// Roster refill (backend #138): one POST reads up to 12 roster characters in
// order (several seconds), then a 10-minute cooldown.
export type CardRefreshEnvelope = Schemas["ApiResponseCardCollectionRefreshResponse"];
export type CardRefresh = Schemas["CardCollectionRefreshResponse"];
const validateRefresh = lazyValidator(() => new Ajv2020({ strict: false, validateFormats: false }).compile<CardRefreshEnvelope>({
  $ref: "#/components/schemas/ApiResponseCardCollectionRefreshResponse",
  components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
}));
export function isCardRefreshEnvelope(value: unknown): value is CardRefreshEnvelope {
  return (
    validateRefresh(value) &&
    value.code === "CHARACTER_CARD_COLLECTION_REFRESH_SUCCESS" &&
    isTime(value.data.nextAvailableAt)
  );
}

/** Result in words; never the backend field names (skipped/failed). */
export function refreshSummary(r: CardRefresh, pressedAt = Date.now()) {
  const parts = [`원정대 ${r.rosterCharacters}명 중 ${r.refreshed}명을 새로 기록했어요.`];
  if (r.skipped > 0) parts.push(`${r.skipped}명은 최근 7일 안에 기록이 있어 그대로 두었어요.`);
  if (r.failed > 0) parts.push(`${r.failed}명은 불러오지 못했어요.`);
  const later = continueText(r.remaining, r.refreshed, minutesUntil(r.nextAvailableAt, pressedAt), "채울");
  if (later) parts.push(`${later}.`);
  return parts.join(" ");
}
