import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import {
  itemSearchParams,
  parsePriceRequest,
  parseQuoteRequest,
  type ItemsEnvelope,
  type OptionsEnvelope,
  type PricesEnvelope,
  type QuoteEnvelope,
} from "./model";
import {
  boardSearchParams,
  parseItemId,
  type BoardEnvelope,
  type ItemHistoryEnvelope,
  type TabsEnvelope,
} from "./board";
import {
  isBoardEnvelope,
  isItemHistoryEnvelope,
  isTabsEnvelope,
  isItemsEnvelope,
  isOptionsEnvelope,
  isPricesEnvelope,
  isQuoteEnvelope,
} from "./validate";

const shared = {
  429: ["LOST_ARK_RATE_LIMITED"],
  502: ["LOST_ARK_API_ERROR"],
  503: ["LOST_ARK_NOT_CONFIGURED", "MARKET_CACHE_UNAVAILABLE"],
  504: ["LOST_ARK_API_TIMEOUT"],
} as const;
const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  415: ["UNSUPPORTED_MEDIA_TYPE"],
  ...shared,
};
const invalid = {
  ok: false as const,
  error: { code: "INVALID_REQUEST", status: 400 },
};

type Options = {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export function requestOptions(
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<OptionsEnvelope>> {
  return requestBackend(backendUrl(origin, "/api/v1/markets/options"), {
    ...options,
    isValid: isOptionsEnvelope,
    errorCodes,
  });
}

export async function requestItems(
  query: URLSearchParams,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<ItemsEnvelope>> {
  const params = itemSearchParams(query);
  if (!params) return invalid;
  const url = backendUrl(origin, "/api/v1/markets/items");
  if (url) url.search = params.toString();
  return requestBackend(url, {
    ...options,
    isValid: isItemsEnvelope,
    errorCodes,
  });
}

export async function requestQuote(
  body: unknown,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<QuoteEnvelope>> {
  const request = parseQuoteRequest(body);
  if (!request) return invalid;
  return requestBackend(backendUrl(origin, "/api/v1/markets/material-quotes"), {
    ...options,
    method: "POST",
    body: request,
    isValid: isQuoteEnvelope,
    errorCodes,
  });
}

export async function requestPrices(
  body: unknown,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<PricesEnvelope>> {
  const request = parsePriceRequest(body);
  if (!request) return invalid;
  return requestBackend(backendUrl(origin, "/api/v1/markets/material-prices"), {
    ...options,
    method: "POST",
    body: request,
    isValid: isPricesEnvelope,
    errorCodes,
  });
}

export function requestTabs(
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<TabsEnvelope>> {
  return requestBackend(backendUrl(origin, "/api/v1/markets/tabs"), {
    ...options,
    isValid: isTabsEnvelope,
    errorCodes,
  });
}

export async function requestBoard(
  query: URLSearchParams,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<BoardEnvelope>> {
  const params = boardSearchParams(query);
  if (!params) return invalid;
  const url = backendUrl(origin, "/api/v1/markets/board");
  if (url) url.search = params.toString();
  return requestBackend(url, { ...options, isValid: isBoardEnvelope, errorCodes });
}

export async function requestItemHistory(
  itemId: string,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<ItemHistoryEnvelope>> {
  const id = parseItemId(itemId);
  if (id == null) return invalid;
  return requestBackend(
    backendUrl(origin, `/api/v1/markets/items/${id}/history`),
    {
      ...options,
      isValid: isItemHistoryEnvelope,
      errorCodes: { ...errorCodes, 404: ["MARKET_ITEM_NOT_FOUND"] },
    },
  );
}
