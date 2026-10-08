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

export const getMarketTabs = (signal?: AbortSignal) =>
  requestTabs(origin(), { signal });
export const getMarketBoard = (query: URLSearchParams, signal?: AbortSignal) =>
  requestBoard(query, origin(), { signal });
export const getItemHistory = (itemId: string, signal?: AbortSignal) =>
  requestItemHistory(itemId, origin(), { signal });

export { toResponse } from "../api/respond";
