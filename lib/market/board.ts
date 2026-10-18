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
];
/** A tab this build can open; the board skips tabs the backend added later. */
/**
 * Names and tier support of the tabs as the backend returns them, used only
 * while the tab list is still loading so the layout already has its final
 * size (the live list replaces it, QA #180 slow-backend path).
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
};

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
  return { tab, tier, sort, page };
}

export function boardQueryString(query: BoardQuery) {
  const out = new URLSearchParams({ tab: query.tab });
  if (query.tier != null) out.set("tier", String(query.tier));
  if (query.sort !== "default") out.set("sort", query.sort);
  if (query.page > 1) out.set("page", String(query.page));
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

/** Completed days, oldest first (for charts); today's partial day is left out. */
export function completedDays(variant: ItemVariant | undefined, limit = 14) {
  if (!variant) return [];
  return variant.days
    .filter((day) => !day.partial)
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
