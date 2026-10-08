import type { BackendResult } from "../api/backend";
import type {
  BoardEnvelope,
  BoardQuery,
  ItemHistoryEnvelope,
  TabsEnvelope,
} from "./board";
import { boardQueryString } from "./board";
import type {
  ItemsEnvelope,
  MarketFailure,
  OptionsEnvelope,
  PriceRequest,
  PricesEnvelope,
  QuoteEnvelope,
  QuoteRequest,
} from "./model";

export class MarketQueryError extends Error {
  info: MarketFailure;
  constructor(info: MarketFailure) {
    super(info.code);
    this.info = info;
  }
}

async function call<T>(input: string, init: RequestInit): Promise<T> {
  try {
    const response = await fetch(input, { ...init, cache: "no-store" });
    const result: BackendResult<T> = await response.json();
    if (!result.ok) throw new MarketQueryError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof MarketQueryError || init.signal?.aborted) throw error;
    throw new MarketQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}

export const fetchMarketOptions = (signal: AbortSignal) =>
  call<OptionsEnvelope>("/api/markets/options", { signal });

export const fetchMarketItems = (
  search: { categoryCode: number; itemName: string; pageNo: number },
  signal: AbortSignal,
) =>
  call<ItemsEnvelope>(
    `/api/markets/items?${new URLSearchParams({
      categoryCode: String(search.categoryCode),
      itemName: search.itemName,
      pageNo: String(search.pageNo),
      sort: "CURRENT_MIN_PRICE",
      sortCondition: "ASC",
    })}`,
    { signal },
  );

export const postMaterialQuote = (body: QuoteRequest, signal?: AbortSignal) =>
  call<QuoteEnvelope>("/api/markets/material-quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

export const postMaterialPrices = (body: PriceRequest, signal?: AbortSignal) =>
  call<PricesEnvelope>("/api/markets/material-prices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

export const fetchMarketTabs = (signal: AbortSignal) =>
  call<TabsEnvelope>("/api/markets/tabs", { signal });

export const fetchMarketBoard = (query: BoardQuery, signal: AbortSignal) =>
  call<BoardEnvelope>(`/api/markets/board?${boardQueryString(query)}`, {
    signal,
  });

export const fetchItemHistory = (itemId: number, signal: AbortSignal) =>
  call<ItemHistoryEnvelope>(`/api/markets/items/${itemId}/history`, {
    signal,
  });
