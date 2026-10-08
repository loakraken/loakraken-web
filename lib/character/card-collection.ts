// Roster card records (F-6): the best card set each element slot has reached
// on any character of the same-server roster, as ILOA's "원정대 카드 기록",
// plus LOAWA's 도감 (best awakening per card) and 장착 효과 (buildable sets).
//
// The backend's OpenAPI for this endpoint currently collides with the armory
// card schemas, so the shape is written out from the backend samples and
// checked by hand. Swap to generated types once the contract is fixed.
export const ELEMENTS = ["LIGHT", "DARK", "LIGHTNING", "EARTH", "WATER", "FIRE"] as const;
export type Element = (typeof ELEMENTS)[number];
export const ELEMENT_LABEL: Record<Element, string> = {
  LIGHT: "성",
  DARK: "암",
  LIGHTNING: "뇌",
  EARTH: "토",
  WATER: "수",
  FIRE: "화",
};

export type SetRecord = {
  cardCount: number;
  awakening: number;
  activeAwakening: number;
  observedAt: string;
  recordedBy: string | null;
};
export type ElementSlot = { element: Element; setName: string; record: SetRecord | null };
export type RecordedCard = {
  name: string;
  grade: string | null;
  icon: string | null;
  awakeCount: number;
  awakeTotal: number;
  observedAt: string;
  recordedBy: string | null;
};
export type SetEffect = { pieces: number; awakening: number; description: string; active: boolean };
export type BuildableSet = {
  setName: string;
  cardCount: number;
  awakening: number;
  activeAwakening: number;
  cards: string[];
  effects: SetEffect[];
  observedAt: string;
  recordedBy: string | null;
};
export type CardCollection = {
  characterName: string;
  serverName: string;
  position: "DEALER" | "SUPPORT" | null;
  rosterCharacters: number;
  observedCharacters: number;
  ruleVersion: string;
  elementRecords: { dealer: ElementSlot[]; supporter: ElementSlot[] };
  cards: RecordedCard[];
  sets: BuildableSet[];
};
export type CardCollectionEnvelope = { code: string; message: string; data: CardCollection };

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isInt = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;
const isStr = (v: unknown): v is string => typeof v === "string";
const isTime = (v: unknown) => isStr(v) && Number.isFinite(Date.parse(v));
const isNullableStr = (v: unknown) => v === null || isStr(v);

const isRecord = (v: unknown) =>
  v === null ||
  (isObject(v) &&
    isInt(v.cardCount) &&
    isInt(v.awakening) &&
    isInt(v.activeAwakening) &&
    isTime(v.observedAt) &&
    isNullableStr(v.recordedBy ?? null));

const isSlots = (v: unknown) =>
  Array.isArray(v) &&
  v.length === ELEMENTS.length &&
  v.every(
    (slot, i) => isObject(slot) && slot.element === ELEMENTS[i] && isStr(slot.setName) && isRecord(slot.record),
  );

const isCard = (v: unknown) =>
  isObject(v) &&
  isStr(v.name) &&
  isNullableStr(v.grade ?? null) &&
  isNullableStr(v.icon ?? null) &&
  isInt(v.awakeCount) &&
  isInt(v.awakeTotal) &&
  isTime(v.observedAt);

const isSet = (v: unknown) =>
  isObject(v) &&
  isStr(v.setName) &&
  isInt(v.cardCount) &&
  isInt(v.awakening) &&
  isInt(v.activeAwakening) &&
  Array.isArray(v.cards) &&
  v.cards.every(isStr) &&
  Array.isArray(v.effects) &&
  v.effects.every(
    (e) => isObject(e) && isInt(e.pieces) && isInt(e.awakening) && isStr(e.description) && typeof e.active === "boolean",
  );

export function isCardCollectionEnvelope(value: unknown): value is CardCollectionEnvelope {
  if (!isObject(value) || value.code !== "CHARACTER_CARD_COLLECTION_SUCCESS") return false;
  const d = value.data;
  return (
    isObject(d) &&
    isStr(d.characterName) &&
    isStr(d.serverName) &&
    (d.position === null || d.position === "DEALER" || d.position === "SUPPORT") &&
    isInt(d.rosterCharacters) &&
    isInt(d.observedCharacters) &&
    isStr(d.ruleVersion) &&
    isObject(d.elementRecords) &&
    isSlots(d.elementRecords.dealer) &&
    isSlots(d.elementRecords.supporter) &&
    Array.isArray(d.cards) &&
    d.cards.every(isCard) &&
    Array.isArray(d.sets) &&
    d.sets.every(isSet)
  );
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
