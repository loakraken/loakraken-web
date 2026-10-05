import "server-only";
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

export { toResponse } from "../api/respond";
