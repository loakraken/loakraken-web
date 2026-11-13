// Market board (B-5): category tabs, sorted price board and per-item 14-day
// history, laid out like the market pages of the other Lost Ark sites.
import type { components } from "../api/market-schema";

type Schemas = components["schemas"];
export type MarketTabs = Schemas["MarketTabsResponse"];
export type MarketTab = Schemas["MarketTabResponse"];
export type TabId = MarketTab["tab"];
export type MarketBoard = Schemas["MarketBoardResponse"];
export type BoardItem = Schemas["MarketBoardItemResponse"];
export type ItemHistory = Schemas["MarketItemHistoryResponse"];
export type ItemVariant = Schemas["MarketItemVariantResponse"];
export type DailyStat = Schemas["MarketDailyStatResponse"];
type Envelope<T> = { code: string; message: string; data: T };
export type TabsEnvelope = Envelope<MarketTabs>;
export type BoardEnvelope = Envelope<MarketBoard>;
export type ItemHistoryEnvelope = Envelope<ItemHistory>;

export const TAB_IDS: readonly TabId[] = [
  "REFINING",
  "REFINING_EXTRA",
  "ARK_GRID",
  "WEAPON_EVOLUTION",
  "ENGRAVING_BOOK",
  "LIFE",
  "BATTLE_ITEM",
  "FOOD",
  "AVATAR",
  "EQUIPMENT_BOX",
];
/** A tab this build can open; the board skips tabs the backend added later. */
/**
 * Names, order and tier support of the tabs as the backend returns them: the
 * market's category row always draws this list, so the server's HTML and the
 * browser show the same row (codex #1597 P2-2); the api's own list only marks
 * a tab it does not open. Also the board's tier rule while that list loads
 * (QA #180 slow-backend path).
 */
export const TAB_FALLBACK: readonly { tab: TabId; label: string; tiered: boolean }[] = [
  { tab: "REFINING", label: "재련 재료", tiered: true },
  { tab: "REFINING_EXTRA", label: "재련 추가 재료", tiered: true },
  { tab: "ARK_GRID", label: "아크 그리드 재료", tiered: false },
  { tab: "WEAPON_EVOLUTION", label: "무기 진화 재료", tiered: false },
  { tab: "ENGRAVING_BOOK", label: "각인서", tiered: false },
  { tab: "LIFE", label: "생활", tiered: false },
  { tab: "BATTLE_ITEM", label: "전투 용품", tiered: false },
  { tab: "FOOD", label: "요리", tiered: false },
  // 아바타 (gap #11, api #873): every api in service opens it (api master since 11-09); an api
  // without it marks it as not open instead of taking it out of the row.
  { tab: "AVATAR", label: "아바타", tiered: false },
  // 장비 상자 is not in the row: the api's own tab list leaves it out (MarketTabsResponse), so the
  // row matches what the site shows (PM 총괄 11-14). Its address still opens the board.
];

export const isTabId = (value: string): value is TabId => (TAB_IDS as readonly string[]).includes(value);

export const SORTS = [
  { id: "default", label: "기본" },
  { id: "high", label: "고가" },
  { id: "low", label: "저가" },
  { id: "rise", label: "상승" },
  { id: "fall", label: "하락" },
] as const;
export type SortId = (typeof SORTS)[number]["id"];

export type BoardQuery = {
  tab: TabId;
  tier: number | null;
  sort: SortId;
  page: number;
  /** Item name search (api #624): a part of the name or its initials (ㅇㅂㄷ); null for none. */
  q: string | null;
  /** 각인서 grade filter (user 11-12; the board's `grade`, applied over the whole tab); null = 전체. */
  grade: BookGrade | null;
};

/** The grades the 각인서 filter offers (전체 is no filter). The api takes any official grade name. */
export const BOOK_GRADES = ["유물", "전설"] as const;
export type BookGrade = (typeof BOOK_GRADES)[number];
export const isBookGrade = (value: string | null | undefined): value is BookGrade =>
  (BOOK_GRADES as readonly string[]).includes(value ?? "");

/** What the backend takes in a search (api #624): after trimming, 1~20 of these. */
const SEARCH = /^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9 ·()+\-:]{1,20}$/;

/**
 * The search box text as the backend reads it: trimmed only (as the server
 * does). `q` null with `invalid` false is "no search"; `invalid` is text the
 * server would refuse, so nothing is sent and a short note says why.
 */
export function readSearch(text: string | null | undefined): { q: string | null; invalid: boolean } {
  const value = (text ?? "").trim();
  if (!value) return { q: null, invalid: false };
  return SEARCH.test(value) ? { q: value, invalid: false } : { q: null, invalid: true };
}

const isInt = (text: string, min: number, max: number) =>
  /^\d{1,2}$/.test(text) && Number(text) >= min && Number(text) <= max;

/** Allow-list for the board query (server side, before any backend call). */
export function boardSearchParams(input: URLSearchParams): URLSearchParams | null {
  const out = new URLSearchParams();
  const tab = input.get("tab") ?? "";
  if (!(TAB_IDS as readonly string[]).includes(tab)) return null;
  out.set("tab", tab);
  const tier = input.get("tier");
  if (tier !== null && tier !== "") {
    if (!isInt(tier, 1, 4)) return null;
    out.set("tier", String(Number(tier)));
  }
  const sort = input.get("sort");
  if (sort !== null) {
    if (!SORTS.some((s) => s.id === sort)) return null;
    out.set("sort", sort);
  }
  const page = input.get("page");
  if (page !== null) {
    if (!isInt(page, 1, 10)) return null;
    out.set("page", String(Number(page)));
  }
  const q = input.get("q");
  if (q !== null) {
    const search = readSearch(q);
    if (search.invalid) return null;
    if (search.q) out.set("q", search.q);
  }
  // Only the grades the screen offers go on (an older api ignores it).
  const grade = input.get("grade");
  if (grade !== null && grade !== "") {
    if (!isBookGrade(grade)) return null;
    out.set("grade", grade);
  }
  return out;
}

/** Positive integer item id (path parameter), or null. */
export function parseItemId(value: string): number | null {
  if (!/^\d{1,9}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}

/** Board query from the page URL, falling back to the first tab and defaults. */
export function readBoardQuery(params: {
  tab?: string | string[];
  tier?: string | string[];
  sort?: string | string[];
  page?: string | string[];
  q?: string | string[];
  grade?: string | string[];
}): BoardQuery {
  const one = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : "";
  const tab = (TAB_IDS as readonly string[]).includes(one(params.tab))
    ? (one(params.tab) as TabId)
    : "REFINING";
  const tier = isInt(one(params.tier), 1, 4) ? Number(one(params.tier)) : null;
  const sort = SORTS.some((s) => s.id === one(params.sort))
    ? (one(params.sort) as SortId)
    : "default";
  const page = isInt(one(params.page), 1, 10) ? Number(one(params.page)) : 1;
  // The grade filter belongs to 각인서 only (user 11-12); elsewhere it is ignored.
  const grade = tab === "ENGRAVING_BOOK" && isBookGrade(one(params.grade)) ? (one(params.grade) as BookGrade) : null;
  return { tab, tier, sort, page, q: readSearch(one(params.q)).q, grade };
}

export function boardQueryString(query: BoardQuery) {
  const out = new URLSearchParams({ tab: query.tab });
  if (query.tier != null) out.set("tier", String(query.tier));
  if (query.sort !== "default") out.set("sort", query.sort);
  if (query.page > 1) out.set("page", String(query.page));
  if (query.q) out.set("q", query.q);
  if (query.grade) out.set("grade", query.grade);
  return out.toString();
}

/** "▲1.1%" / "▼0.7%" / "0.0%" / "—" with a direction for colouring. */
export function changeLabel(value: number | null | undefined) {
  if (value == null) return { text: "—", direction: "none" as const };
  const fixed = Math.abs(value).toLocaleString("ko-KR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  if (value > 0) return { text: `▲${fixed}%`, direction: "up" as const };
  if (value < 0) return { text: `▼${fixed}%`, direction: "down" as const };
  return { text: `${fixed}%`, direction: "flat" as const };
}

export function goldText(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}G`;
}

/**
 * Chart ranges (user 11-12, api #920): 1시간 (exchange minutes), then days.
 * An api from before #920 answers 14 days and echoes no `range`: the chart
 * then keeps its old 1시간 · 7일 · 14일 tabs.
 */
export type DayRange = 7 | 14 | 30 | 90 | 365;
export type ChartRange = "hour" | DayRange;
export const RANGE_LABEL: Record<DayRange, string> = { 7: "7일", 14: "14일", 30: "30일", 90: "3개월", 365: "1년" };
export const STORED_RANGES = ["hour", 7, 30, 90, 365] as const satisfies readonly ChartRange[];
export const OLD_RANGES = ["hour", 7, 14] as const satisfies readonly ChartRange[];
export type HistoryRange = "30d" | "90d" | "365d";
/** The history answer a day range reads: 7 and 30 (and the old 14) come from one 30-day answer. */
export const historyRange = (range: DayRange): HistoryRange => (range === 90 ? "90d" : range === 365 ? "365d" : "30d");
/** One cache entry per item and answer range (the page's first item is prefetched with 30d). */
export const historyKey = (itemId: number, range: HistoryRange) => ["market", "history", itemId, range] as const;

/** The first date of a `range`-day window that ends on `baseDate` (both YYYY-MM-DD), as the api counts it. */
export function windowStart(baseDate: string, range: number) {
  const [y, m, d] = baseDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - (range - 1))).toISOString().slice(0, 10);
}

/**
 * Completed days, oldest first (for charts); today's partial day is left out. With `baseDate`
 * only the days inside the `limit`-day calendar window count (codex #1595 P2: 7일 reads the
 * 30-day answer, so with sparse records the last 7 rows could be weeks old).
 */
export function completedDays(variant: ItemVariant | undefined, limit = 14, baseDate?: string) {
  if (!variant) return [];
  const from = baseDate ? windowStart(baseDate, limit) : null;
  return variant.days
    .filter((day) => !day.partial && (from == null || day.date >= from))
    .slice(0, limit)
    .reverse();
}

/** Price per unit when an item trades in bundles (the 개당 column). */
export function unitPrice(price: number | null | undefined, bundleCount: number) {
  if (price == null || bundleCount <= 1) return null;
  return price / bundleCount;
}

/** "▲8.5G (4.7%)": absolute gold change against yesterday's average (with its unit), then the rate. */
export function changeWithAmount(item: {
  currentMinPrice: number | null;
  yesterdayAvgPrice: number | null;
  changeDay: number | null;
}) {
  const rate = changeLabel(item.changeDay);
  if (item.currentMinPrice == null || item.yesterdayAvgPrice == null || rate.direction === "none")
    return rate;
  const diff = item.currentMinPrice - item.yesterdayAvgPrice;
  const amount = Math.abs(diff).toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  const sign = rate.direction === "up" ? "▲" : rate.direction === "down" ? "▼" : "";
  const pct = rate.text.replace(/^[▲▼]/, "");
  return { text: `${sign}${amount}G (${pct})`, direction: rate.direction };
}

/** "방금 갱신" / "3분 전 갱신" / "2시간 전 갱신" — never "실시간". */
export function updatedAgo(observedAt: string, now: number) {
  const minutes = Math.floor((now - Date.parse(observedAt)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "방금 갱신";
  if (minutes < 60) return `${minutes}분 전 갱신`;
  return `${Math.floor(minutes / 60)}시간 전 갱신`;
}
