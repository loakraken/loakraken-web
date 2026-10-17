// T4 악세 경매 검색기 (checklist N13, backend #431): search the official
// auction house for T4 accessories by polish effects, enlightenment, main-stat
// range and quality. Types follow the backend records (AccessorySearchRequest,
// AccessorySearchResponses); the catalog below mirrors its AuctionCatalog and
// AccessoryStatRange so the form offers only what the backend accepts.

import type { components } from "../api/accessory-search-schema";

export const SLOTS = [
  { id: "NECKLACE", label: "목걸이" },
  { id: "EARRING", label: "귀걸이" },
  { id: "RING", label: "반지" },
] as const;
export type Slot = (typeof SLOTS)[number]["id"];

export const GRADES = [
  { id: "ANCIENT", label: "고대" },
  { id: "RELIC", label: "유물" },
] as const;
export type Grade = (typeof GRADES)[number]["id"];

export const ROLES = [
  { id: "DEALER", label: "딜러" },
  { id: "SUPPORT", label: "서포터" },
] as const;
export type Role = (typeof ROLES)[number]["id"];

export const LEVELS = [
  { id: "LOW", label: "하" },
  { id: "MID", label: "중" },
  { id: "HIGH", label: "상" },
] as const;
export type Level = (typeof LEVELS)[number]["id"];

/** Polish effects the search takes; short names as players write them. */
export const POLISH_OPTIONS = {
  ENEMY_DAMAGE: { name: "적에게 주는 피해 증가", short: "적주피" },
  ADDITIONAL_DAMAGE: { name: "추가 피해", short: "추피" },
  WEAPON_ATTACK_PERCENT: { name: "무기 공격력 %", short: "무공%" },
  ATTACK_PERCENT: { name: "공격력 %", short: "공%" },
  CRIT_DAMAGE: { name: "치명타 피해", short: "치피" },
  CRIT_RATE: { name: "치명타 적중률", short: "치적" },
  BRAND: { name: "낙인력", short: "낙인력" },
  IDENTITY_GAUGE: { name: "세레나데, 신앙, 조화 게이지 획득량 증가", short: "아덴" },
  ALLY_DAMAGE: { name: "아군 피해량 강화 효과", short: "아피강" },
  ALLY_ATTACK: { name: "아군 공격력 강화 효과", short: "아공강" },
} as const;
export type PolishOption = keyof typeof POLISH_OPTIONS;

/** Core polish effects per role and slot (backend AuctionCatalog.options). */
export const OPTIONS_BY: Record<Role, Record<Slot, PolishOption[]>> = {
  DEALER: {
    NECKLACE: ["ENEMY_DAMAGE", "ADDITIONAL_DAMAGE"],
    EARRING: ["WEAPON_ATTACK_PERCENT", "ATTACK_PERCENT"],
    RING: ["CRIT_DAMAGE", "CRIT_RATE"],
  },
  SUPPORT: {
    NECKLACE: ["BRAND", "IDENTITY_GAUGE"],
    EARRING: ["WEAPON_ATTACK_PERCENT"],
    RING: ["ALLY_DAMAGE", "ALLY_ATTACK"],
  },
};

/** Highest enlightenment a grade and slot can roll (backend AccessoryStatRange). */
export const ENLIGHTENMENT_MAX: Record<Grade, Record<Slot, number>> = {
  RELIC: { NECKLACE: 10, EARRING: 9, RING: 9 },
  ANCIENT: { NECKLACE: 13, EARRING: 12, RING: 12 },
};

export type PolishLine = { option: PolishOption; level: Level | null };
export type SearchRequest = {
  slot: Slot;
  grade: Grade;
  polish: PolishLine[];
  enlightenmentMin: number | null;
  mainStatRangeMinPct: number | null;
  minQuality: number | null;
  sort: "BUY_PRICE";
  page: number;
};

type Schemas = components["schemas"];
export type SearchPolish = Schemas["AccessorySearchPolishResponse"];
export type SearchItem = Schemas["AccessorySearchItemResponse"];
/** totalCount is the official count before the page-level main-stat filter: never shown as a total. */
export type SearchResult = Schemas["AccessorySearchResponse"];
export type SearchEnvelope = { code: string; message: string; data: SearchResult };

const isSlot = (v: unknown): v is Slot => SLOTS.some((s) => s.id === v);
const isGrade = (v: unknown): v is Grade => GRADES.some((g) => g.id === v);
const isLevel = (v: unknown): v is Level => LEVELS.some((l) => l.id === v);
const isOption = (v: unknown): v is PolishOption => typeof v === "string" && Object.hasOwn(POLISH_OPTIONS, v);
const intIn = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** Effects a slot can carry at all (either role). */
export const slotOptions = (slot: Slot): PolishOption[] => [
  ...new Set([...OPTIONS_BY.DEALER[slot], ...OPTIONS_BY.SUPPORT[slot]]),
];

/**
 * The request the proxy forwards, or null when the backend would refuse it
 * (unknown values, an effect the slot cannot have, the same effect twice,
 * values out of range). Mirrors the backend's 400 INVALID_AUCTION_FILTER.
 */
export function parseSearchRequest(body: unknown): SearchRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (!isSlot(b.slot) || !isGrade(b.grade)) return null;
  const polishRaw = b.polish ?? [];
  if (!Array.isArray(polishRaw) || polishRaw.length > 3) return null;
  const allowed = slotOptions(b.slot);
  const polish: PolishLine[] = [];
  for (const line of polishRaw) {
    if (typeof line !== "object" || line === null) return null;
    const { option, level } = line as Record<string, unknown>;
    if (!isOption(option) || !allowed.includes(option) || polish.some((p) => p.option === option)) return null;
    if (level != null && !isLevel(level)) return null;
    polish.push({ option, level: level ?? null });
  }
  const optional = (v: unknown, min: number, max: number) => (v == null ? null : intIn(v, min, max) ? (v as number) : undefined);
  const enlightenmentMin = optional(b.enlightenmentMin, 0, ENLIGHTENMENT_MAX[b.grade][b.slot]);
  const mainStatRangeMinPct = optional(b.mainStatRangeMinPct, 0, 100);
  const minQuality = optional(b.minQuality, 0, 100);
  const page = b.page == null ? 1 : intIn(b.page, 1, 10) ? (b.page as number) : undefined;
  if (enlightenmentMin === undefined || mainStatRangeMinPct === undefined || minQuality === undefined || page === undefined)
    return null;
  if (b.sort != null && b.sort !== "BUY_PRICE") return null;
  return { slot: b.slot, grade: b.grade, polish, enlightenmentMin, mainStatRangeMinPct, minQuality, sort: "BUY_PRICE", page };
}

/** "2.00%" or "+390": the official display of a polish line value. */
export function polishValue(line: SearchPolish) {
  if (line.value == null) return "";
  const text = line.value.toLocaleString("ko-KR", { minimumFractionDigits: line.percentage ? 2 : 0, maximumFractionDigits: 2 });
  return line.percentage ? `${text}%` : `+${text}`;
}

export const levelLabel = (level: string | null) => LEVELS.find((l) => l.id === level)?.label ?? null;

/** What the list covers: the whole search, or only the pages read so far (A21). */
export function coverageText(result: Pick<SearchResult, "complete" | "scannedPages">, pagesRead: number) {
  return result.complete ? null : `찾은 페이지 안의 결과예요(${pagesRead}쪽 읽음)`;
}
