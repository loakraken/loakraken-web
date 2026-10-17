import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { parseSearchRequest, type SearchEnvelope } from "./model";
import { isSearchEnvelope } from "./validate";

// Backend #431 AccessorySearchController, error table.
const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "INVALID_AUCTION_FILTER"],
  // Listed for the status (and Retry-After); the code becomes the shared LOST_ARK_RATE_LIMITED.
  429: [],
  503: ["MARKET_SEARCH_BUSY", "LOST_ARK_NOT_CONFIGURED"],
  504: ["LOST_ARK_API_TIMEOUT"],
};

type Options = { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number };

export async function requestAccessorySearch(
  body: unknown,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<SearchEnvelope>> {
  const request = parseSearchRequest(body);
  if (!request) return { ok: false, error: { code: "INVALID_REQUEST", status: 400 } };
  return requestBackend(backendUrl(origin, "/api/v1/markets/auctions/accessories/search"), {
    // Up to three official pages are read behind one search.
    timeoutMs: 30_000,
    ...options,
    method: "POST",
    body: request,
    isValid: isSearchEnvelope,
    errorCodes,
  });
}
