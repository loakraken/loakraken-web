import "server-only";
import type { BackendResult } from "../api/backend";
import { requestItems, requestOptions, requestQuote } from "./upstream";

const origin = () => process.env.LOAKRAKEN_API_ORIGIN;

export const getMarketOptions = (signal?: AbortSignal) =>
  requestOptions(origin(), { signal });
export const searchMarketItems = (
  query: URLSearchParams,
  signal?: AbortSignal,
) => requestItems(query, origin(), { signal });
export const quoteMaterials = (body: unknown, signal?: AbortSignal) =>
  requestQuote(body, origin(), { signal });

export function toResponse(result: BackendResult<unknown>) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (!result.ok && result.error.retryAt)
    headers["Retry-After"] = String(
      Math.max(1, Math.ceil((result.error.retryAt - Date.now()) / 1000)),
    );
  return Response.json(result, {
    status: result.ok ? 200 : result.error.status,
    headers,
  });
}
