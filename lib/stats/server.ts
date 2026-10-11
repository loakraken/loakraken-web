import "server-only";
import type { StatsQuery, StatsView } from "./model";
import { requestStats } from "./upstream";
import { requestRankings, type RankingQuery } from "./rankings";
import { requestRosterRanking, type RosterQuery } from "./roster-ranking";
import { requestCollectibleRanking, type CollectibleQuery } from "./collectible-ranking";

export function getStats<V extends StatsView>(view: V, query: StatsQuery, signal?: AbortSignal) {
  return requestStats(view, query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getRankings(query: RankingQuery, signal?: AbortSignal) {
  return requestRankings(query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getRosterRanking(query: RosterQuery, signal?: AbortSignal) {
  return requestRosterRanking(query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getCollectibleRanking(query: CollectibleQuery, signal?: AbortSignal) {
  return requestCollectibleRanking(query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}
