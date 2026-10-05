import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import {
  itemSearchParams,
  parseQuoteRequest,
  type ItemsEnvelope,
  type OptionsEnvelope,
  type QuoteEnvelope,
} from "./model";
import {
  isItemsEnvelope,
  isOptionsEnvelope,
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
