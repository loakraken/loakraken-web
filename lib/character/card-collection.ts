// Roster card records (F-6): the best card set each element slot has reached
// on any character of the same-server roster, as ILOA's "원정대 카드 기록",
// plus LOAWA's 도감 (best awakening per card) and 장착 효과 (buildable sets).
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/card-collection.openapi.json";
import type { components } from "../api/card-collection-schema";

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

// The backend's generated OpenAPI (#102) is also the runtime shape contract.
const validate = new Ajv2020({ strict: false, validateFormats: false }).compile<CardCollectionEnvelope>({
  $ref: "#/components/schemas/ApiResponseCardCollectionResponse",
  components: contract.components,
});
const isTime = (value: string) => Number.isFinite(Date.parse(value));
const inOrder = (slots: ElementSlot[]) =>
  slots.length === ELEMENTS.length && slots.every((slot, i) => slot.element === ELEMENTS[i]);

export function isCardCollectionEnvelope(value: unknown): value is CardCollectionEnvelope {
  if (!validate(value) || value.code !== "CHARACTER_CARD_COLLECTION_SUCCESS") return false;
  const d = value.data;
  return (
    inOrder(d.elementRecords.dealer) &&
    inOrder(d.elementRecords.supporter) &&
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

/** The six element slots for the character's role (supporters see 서폿 sets). */
export function slotsFor(data: CardCollection) {
  return data.position === "SUPPORT" ? data.elementRecords.supporter : data.elementRecords.dealer;
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
