import "server-only";
import type { StatsQuery, StatsView } from "./model";
import { requestStats } from "./upstream";
import { requestEfficiencyRanking, requestRankings, type EfficiencyKind, type EfficiencyQuery, type RankingQuery } from "./rankings";
import { requestRosterRanking, type RosterQuery } from "./roster-ranking";
import { requestGuildRanking, type GuildQuery } from "./guild-ranking";
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

export function getEfficiencyRanking(kind: EfficiencyKind, query: EfficiencyQuery, signal?: AbortSignal) {
  return requestEfficiencyRanking(kind, query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getGuildRanking(query: GuildQuery, signal?: AbortSignal) {
  return requestGuildRanking(query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}
