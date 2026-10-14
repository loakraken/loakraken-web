import "server-only";
import {
  requestBoard,
  requestItemHistory,
  requestTabs,
  requestItems,
  requestOptions,
  requestPrices,
  requestQuote,
} from "./upstream";
import { requestGemBoard, requestGemListings, type GemPick } from "./auction-gems";
import { requestItemMinutes } from "./minutes";
import {
  requestAccessoryBoard,
  requestAccessoryListings,
  type AccessoryFilter,
  type AccessoryPick,
} from "./auction-accessories";

const origin = () => process.env.LOAKRAKEN_API_ORIGIN;

export const getMarketOptions = (signal?: AbortSignal) =>
  requestOptions(origin(), { signal });
export const searchMarketItems = (
  query: URLSearchParams,
  signal?: AbortSignal,
) => requestItems(query, origin(), { signal });
export const quoteMaterials = (body: unknown, signal?: AbortSignal) =>
  requestQuote(body, origin(), { signal });

export const priceMaterials = (body: unknown, signal?: AbortSignal) =>
  requestPrices(body, origin(), { signal });

export const getMarketTabs = (signal?: AbortSignal, timeoutMs?: number) =>
  requestTabs(origin(), { signal, timeoutMs });
export const getMarketBoard = (query: URLSearchParams, signal?: AbortSignal, timeoutMs?: number) =>
  requestBoard(query, origin(), { signal, timeoutMs });
export const getItemHistory = (itemId: string, signal?: AbortSignal, timeoutMs?: number) =>
  requestItemHistory(itemId, origin(), { signal, timeoutMs });
export const getItemMinutes = (itemId: number, signal?: AbortSignal) =>
  requestItemMinutes(itemId, origin(), { signal });

export const getGemBoard = (signal?: AbortSignal, timeoutMs?: number) =>
  requestGemBoard(origin(), { signal, timeoutMs });
export const getGemListings = (pick: GemPick, signal?: AbortSignal) =>
  requestGemListings(pick, origin(), { signal });

export const getAccessoryBoard = (filter: AccessoryFilter, signal?: AbortSignal, timeoutMs?: number) =>
  requestAccessoryBoard(filter, origin(), { signal, timeoutMs });
export const getAccessoryListings = (filter: AccessoryFilter, pick: AccessoryPick, signal?: AbortSignal) =>
  requestAccessoryListings(filter, pick, origin(), { signal });

export { toResponse } from "../api/respond";
