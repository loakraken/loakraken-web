import type { components } from "../api/market-schema";
import { rateLimitCopy } from "../api/rate-limit";
import { UNKNOWN_LABEL } from "../api/tolerant";

type Schemas = components["schemas"];
export type MarketOptions = Schemas["MarketOptionsResponse"];
export type MarketCategory = Schemas["MarketCategoryResponse"];
export type MarketPriceItem = Schemas["MarketPriceItem"];
export type MarketPriceResult = Schemas["MarketPriceResponse"];
export type MaterialQuote = Schemas["MaterialQuoteResponse"];
export type MaterialQuoteLine = Schemas["MaterialQuoteLineResponse"];
export type QuoteStatus = MaterialQuoteLine["status"];
export type PriceBasis = MaterialQuote["priceBasis"];

/**
 * The official market's categories that never hold a listing (a search in
 * them finds nothing and they have no sub-category, checked 10-18): 장비 상자
 * and 보석 상자. Left out of the material quote's list by their official
 * codes, not their names (user decision v0.3.2); every other one stays.
 */
export const EMPTY_MARKET_CATEGORIES: ReadonlySet<number> = new Set([10100, 220000]);

export const quoteCategories = (categories: readonly MarketCategory[]) =>
  categories.filter((category) => !EMPTY_MARKET_CATEGORIES.has(category.code));
type Envelope<T> = { code: string; message: string; data: T };
export type OptionsEnvelope = Envelope<MarketOptions>;
export type ItemsEnvelope = Envelope<MarketPriceResult>;
export type QuoteEnvelope = Envelope<MaterialQuote>;
export type MaterialPrices = Schemas["MaterialPriceResponse"];
export type MaterialPrice = Schemas["MaterialPriceItemResponse"];
export type PricesEnvelope = Envelope<MaterialPrices>;
export type PriceRequest = { priceBasis: PriceBasis; names: string[] };
export const MAX_PRICE_NAMES = 20;

// The generated request schema renders Java Long as string; the backend accepts
// (and requires) JSON integers, so the frontend sends numbers.
export type MarketSearch = {
  categoryCode: number;
  itemName: string;
  pageNo: number;
};
export type QuoteItemRequest = {
  itemId: number;
  requiredQuantity: number;
  ownedQuantity: number;
  search: MarketSearch;
};
export type QuoteRequest = {
  priceBasis: PriceBasis;
  items: QuoteItemRequest[];
};

export const MAX_QUOTE_ITEMS = 10;
export const MAX_QUANTITY = 999_999_999;
const MAX_ITEM_ID = Number.MAX_SAFE_INTEGER;

export const priceBases: {
  value: PriceBasis;
  label: string;
  hint: string;
}[] = [
  {
    value: "CURRENT_MIN_PRICE",
    label: "현재 최저가",
    hint: "지금 판매 중인 묶음의 최저 가격입니다. 그 가격에 남은 수량은 알 수 없어요.",
  },
  {
    value: "RECENT_PRICE",
    label: "최근 거래가",
    hint: "가장 최근에 체결된 묶음 가격입니다. 지금 살 수 있는 가격은 현재 최저가예요.",
  },
  {
    value: "YDAY_AVG_PRICE",
    label: "전일 평균가",
    hint: "전날 거래된 묶음의 평균 가격입니다. 소수 골드가 나올 수 있어요.",
  },
];

export function normalizeText(value: string) {
  return value.trim().normalize("NFC");
}

/** Whole numbers only, no separators; decimals are rejected rather than truncated. */
export function parseQuantity(value: string): number | null {
  const text = value.trim();
  if (!/^\d{1,9}$/.test(text)) return null;
  const quantity = Number(text);
  return quantity <= MAX_QUANTITY ? quantity : null;
}

export function quantityError(value: string) {
  if (!value.trim()) return "수량을 입력해 주세요.";
  if (/[.,]/.test(value)) return "소수나 쉼표 없이 정수로 입력해 주세요.";
  return parseQuantity(value) === null
    ? "0 이상 999,999,999 이하의 정수로 입력해 주세요."
    : "";
}

export function searchError(categoryCode: number | null, itemName: string) {
  if (!categoryCode || !Number.isInteger(categoryCode) || categoryCode <= 0)
    return "카테고리를 선택해 주세요.";
  const name = normalizeText(itemName);
  if (!name) return "재료 이름을 입력해 주세요.";
  if (name.length > 64) return "재료 이름은 64자 이내로 입력해 주세요.";
  return "";
}

const sorts = ["GRADE", "YDAY_AVG_PRICE", "RECENT_PRICE", "CURRENT_MIN_PRICE"];
const conditions = ["ASC", "DESC"];

/** Server-side allow-list for the item search query (before any backend call). */
export function itemSearchParams(
  input: URLSearchParams,
): URLSearchParams | null {
  const out = new URLSearchParams();
  const category = input.get("categoryCode") ?? "";
  if (!/^\d{1,9}$/.test(category) || Number(category) <= 0) return null;
  out.set("categoryCode", String(Number(category)));
  const name = normalizeText(input.get("itemName") ?? "");
  if (name.length > 64) return null;
  if (name) out.set("itemName", name);
  const page = input.get("pageNo");
  if (page !== null) {
    if (!/^\d{1,4}$/.test(page) || Number(page) < 1 || Number(page) > 1000)
      return null;
    out.set("pageNo", String(Number(page)));
  }
  const sort = input.get("sort");
  if (sort !== null) {
    if (!sorts.includes(sort)) return null;
    out.set("sort", sort);
  }
  const condition = input.get("sortCondition");
  if (condition !== null) {
    if (!conditions.includes(condition)) return null;
    out.set("sortCondition", condition);
  }
  return out;
}

function isSearch(value: unknown): value is MarketSearch {
  if (!value || typeof value !== "object") return false;
  const search = value as Record<string, unknown>;
  return (
    Number.isInteger(search.categoryCode) &&
    (search.categoryCode as number) > 0 &&
    typeof search.itemName === "string" &&
    normalizeText(search.itemName).length <= 64 &&
    Number.isInteger(search.pageNo) &&
    (search.pageNo as number) >= 1 &&
    (search.pageNo as number) <= 1000
  );
}

const quantityOk = (value: unknown) =>
  Number.isInteger(value) &&
  (value as number) >= 0 &&
  (value as number) <= MAX_QUANTITY;

/** Validates and re-shapes a quote request; unknown keys are dropped. */
export function parseQuoteRequest(value: unknown): QuoteRequest | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (!priceBases.some((basis) => basis.value === body.priceBasis)) return null;
  if (!Array.isArray(body.items)) return null;
  if (body.items.length < 1 || body.items.length > MAX_QUOTE_ITEMS) return null;
  const ids = new Set<number>();
  const items: QuoteItemRequest[] = [];
  for (const raw of body.items) {
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>;
    if (
      !Number.isInteger(item.itemId) ||
      (item.itemId as number) < 1 ||
      (item.itemId as number) > MAX_ITEM_ID ||
      !quantityOk(item.requiredQuantity) ||
      !quantityOk(item.ownedQuantity) ||
      !isSearch(item.search) ||
      ids.has(item.itemId as number)
    )
      return null;
    ids.add(item.itemId as number);
    items.push({
      itemId: item.itemId as number,
      requiredQuantity: item.requiredQuantity as number,
      ownedQuantity: item.ownedQuantity as number,
      search: {
        categoryCode: item.search.categoryCode,
        itemName: normalizeText(item.search.itemName),
        pageNo: item.search.pageNo,
      },
    });
  }
  return { priceBasis: body.priceBasis as PriceBasis, items };
}

/** Material unit prices by name (#76); names are trimmed and de-duplicated. */
export function parsePriceRequest(value: unknown): PriceRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (!priceBases.some((basis) => basis.value === body.priceBasis)) return null;
  if (!Array.isArray(body.names)) return null;
  const names: string[] = [];
  for (const raw of body.names) {
    if (typeof raw !== "string") return null;
    const name = normalizeText(raw);
    if (!name || name.length > 64) return null;
    if (!names.includes(name)) names.push(name);
  }
  if (names.length < 1 || names.length > MAX_PRICE_NAMES) return null;
  return { priceBasis: body.priceBasis as PriceBasis, names };
}

/** Display only; the backend's exact value is kept for any further use. */
export function formatGold(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

export const statusCopy: Record<QuoteStatus, { label: string; text: string }> =
  {
    PRICED: { label: "계산됨", text: "선택한 묶음 가격으로 계산했어요." },
    COVERED_BY_INVENTORY: {
      label: "보유량으로 충분",
      text: "보유 수량으로 충당돼 시세를 조회하지 않았어요.",
    },
    ITEM_NOT_IN_PAGE: {
      label: "검색 페이지에 없음",
      text: "저장한 검색 페이지에서 이 상품을 찾지 못했어요. 상품이 다른 페이지로 옮겨졌을 수 있으니 다시 검색해 주세요.",
    },
    AMBIGUOUS_ITEM: {
      label: "상품 중복",
      text: "같은 상품이 페이지에 여러 번 있어 하나로 정할 수 없어요.",
    },
    TRADE_RESTRICTED_ITEM: {
      label: "거래 제한 상품",
      text: "재거래 조건이 있는 상품이라 이 견적에서 제외했어요.",
    },
    PRICE_UNAVAILABLE: {
      label: "가격 없음",
      text: "선택한 가격 기준의 값이 제공되지 않았어요. 다른 기준으로 대체하지 않습니다.",
    },
    ZERO_PRICE: {
      label: "0골드 가격",
      text: "원천 가격이 0이에요. 무료 구매로 해석하지 않고 계산에서 제외했어요.",
    },
  };

/**
 * A material price with no value (PRICE_UNAVAILABLE) and why (api #600). A
 * search or call limit clears by itself, and the plan fetches prices again every
 * minute, so it says so; an outage, no reason or a reason this build does not
 * know keeps the plain "no price".
 */
export function priceUnavailableCopy(reason: string | null | undefined): string {
  return reason === "RATE_LIMITED" || reason === "SEARCH_LIMIT"
    ? "지금은 못 불러왔어요 · 잠시 뒤 다시 불러와요"
    : "선택한 기준의 가격이 없어요";
}

/** Status copy; a status this build does not know yet is shown as unknown. */
export function quoteStatusCopy(status: string): { label: string; text: string } {
  return Object.hasOwn(statusCopy, status)
    ? statusCopy[status as QuoteStatus]
    : { label: UNKNOWN_LABEL, text: "이 항목의 상태를 아직 표시할 수 없어요." };
}

export type MarketFailure = { code: string; status: number; retryAt?: number; limit?: "client" };

export function marketFailureCopy(error: MarketFailure) {
  switch (error.code) {
    case "INVALID_REQUEST":
      return {
        title: "입력값을 확인해 주세요",
        text: "검색 조건이나 수량이 허용 범위를 벗어났어요.",
      };
    case "LOST_ARK_RATE_LIMITED":
      return rateLimitCopy(error);
    case "LOST_ARK_API_TIMEOUT":
      return {
        title: "응답이 늦어지고 있어요",
        text: "시세 조회 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.",
      };
    case "FRONTEND_API_NOT_CONFIGURED":
    case "LOST_ARK_NOT_CONFIGURED":
      return {
        title: "시세 서비스 연결을 준비하고 있어요",
        text: "서비스 연결 설정이 끝나면 이용할 수 있어요.",
      };
    case "MARKET_CACHE_UNAVAILABLE":
      return {
        title: "시세 서비스를 잠시 사용할 수 없어요",
        text: "데이터 처리에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
      };
    case "INVALID_API_RESPONSE":
      return {
        title: "결과를 확인할 수 없어요",
        text: "응답 형식이 예상과 달라 표시하지 못했어요.",
      };
    default:
      return {
        title: "시세를 불러오지 못했어요",
        text: "거래소 조회에 실패했어요. 잠시 후 다시 시도해 주세요.",
      };
  }
}
