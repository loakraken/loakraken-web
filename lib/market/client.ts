import type { BackendResult } from "../api/backend";
import type {
  BoardEnvelope,
  BoardQuery,
  ItemHistoryEnvelope,
  TabsEnvelope,
} from "./board";
import { boardQueryString } from "./board";
import type { MinuteChartEnvelope } from "./minutes";
import {
  gemPickSearch,
  type GemBoardEnvelope,
  type GemListingsEnvelope,
  type GemPick,
  type GemSkillsEnvelope,
} from "./auction-gems";
import {
  accessorySearch,
  type AccessoryBoardEnvelope,
  type AccessoryFilter,
  type AccessoryListingsEnvelope,
  type AccessoryPick,
} from "./auction-accessories";
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

/** The price API takes at most this many names a request. */
export const PRICE_NAMES_PER_REQUEST = 20;

/** Material prices for any number of names: requests of up to 20 names, sent together, items joined in order. */
export async function postMaterialPricesAll(body: PriceRequest, signal?: AbortSignal): Promise<PricesEnvelope> {
  const chunks = Array.from({ length: Math.ceil(body.names.length / PRICE_NAMES_PER_REQUEST) }, (_, i) =>
    body.names.slice(i * PRICE_NAMES_PER_REQUEST, (i + 1) * PRICE_NAMES_PER_REQUEST),
  );
  const parts = await Promise.all(chunks.map((names) => postMaterialPrices({ ...body, names }, signal)));
  return { ...parts[0], data: { ...parts[0].data, items: parts.flatMap((p) => p.data.items) } };
}

export const fetchMarketTabs =(signal: AbortSignal) =>
  call<TabsEnvelope>("/api/markets/tabs", { signal });

export const fetchMarketBoard = (query: BoardQuery, signal: AbortSignal) =>
  call<BoardEnvelope>(`/api/markets/board?${boardQueryString(query)}`, {
    signal,
  });

export const fetchItemHistory = (itemId: number, signal: AbortSignal) =>
  call<ItemHistoryEnvelope>(`/api/markets/items/${itemId}/history`, {
    signal,
  });

/** The last hour by minute (K35), from prices the warm-up already fetched. */
export const fetchItemMinutes = (itemId: number, signal: AbortSignal) =>
  call<MinuteChartEnvelope>(`/api/markets/items/${itemId}/minutes`, { signal });

/** T4 gem prices on the auction house (backend cache). */
export const fetchGemBoard = (signal: AbortSignal) => call<GemBoardEnvelope>("/api/markets/auctions/gems", { signal });

/** The cheapest buy-now listings of one gem cell (at most one official call). */
export const fetchGemListings = (pick: GemPick, signal: AbortSignal) =>
  call<GemListingsEnvelope>(`/api/markets/auctions/gems/listings?${gemPickSearch(pick)}`, { signal });

/** The classes and gem skills the listings can be narrowed to (a fixed list on the backend). */
export const fetchGemSkills = (signal: AbortSignal) =>
  call<GemSkillsEnvelope>("/api/markets/auctions/gems/skills", { signal });

/** T4 accessory prices by key polish grades (backend cache). */
export const fetchAccessoryBoard = (filter: AccessoryFilter, signal: AbortSignal) =>
  call<AccessoryBoardEnvelope>(`/api/markets/auctions/accessories?${accessorySearch(filter, null)}`, { signal });

/** The cheapest buy-now listings of one accessory cell (at most one official call). */
export const fetchAccessoryListings = (filter: AccessoryFilter, pick: AccessoryPick, signal: AbortSignal) =>
  call<AccessoryListingsEnvelope>(`/api/markets/auctions/accessories/listings?${accessorySearch(filter, pick)}`, { signal });
