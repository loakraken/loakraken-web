import "server-only";
import type { StatsQuery, StatsView } from "./model";
import { requestStats } from "./upstream";
import { requestRankings, type RankingQuery } from "./rankings";

export function getStats<V extends StatsView>(view: V, query: StatsQuery, signal?: AbortSignal) {
  return requestStats(view, query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getRankings(query: RankingQuery, signal?: AbortSignal) {
  return requestRankings(query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}
