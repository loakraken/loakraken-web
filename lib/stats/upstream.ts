import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import {
  isStatsEnvelope,
  statsSearch,
  type StatsEnvelopes,
  type StatsQuery,
  type StatsView,
} from "./model";

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE", "STATS_TOO_MANY_BINS"],
  429: ["LOST_ARK_RATE_LIMITED"],
  503: ["STATS_UNAVAILABLE"],
};

/** One statistics view with already allow-listed filters (parseStatsQuery). */
export function requestStats<V extends StatsView>(
  view: V,
  query: StatsQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<StatsEnvelopes[V]>> {
  if (view === "distribution" && !query.metric)
    return Promise.resolve({ ok: false, error: { code: "INVALID_REQUEST", status: 400 } });
  const { metric, width, percentileOf, ...filters } = query;
  const params = statsSearch(view === "distribution" ? { ...filters, metric, width, percentileOf } : filters);
  const url = backendUrl(origin, `/api/v1/stats/${view}`);
  if (url) url.search = params.toString();
  return requestBackend(url, {
    ...options,
    isValid: (value): value is StatsEnvelopes[V] => isStatsEnvelope(view, value),
    errorCodes,
  });
}
