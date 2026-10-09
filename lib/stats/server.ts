import "server-only";
import type { StatsQuery, StatsView } from "./model";
import { requestStats } from "./upstream";

export function getStats<V extends StatsView>(view: V, query: StatsQuery, signal?: AbortSignal) {
  return requestStats(view, query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}
