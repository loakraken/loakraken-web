import "server-only";
import type { StatsQuery, StatsView } from "./model";
import { requestStats } from "./upstream";
import { requestEfficiencyRanking, requestRankings, type EfficiencyKind, type EfficiencyQuery, type RankingQuery } from "./rankings";
import { requestRosterRanking, type RosterQuery } from "./roster-ranking";
import { requestGuildRanking, type GuildQuery } from "./guild-ranking";
import { requestPopularGuilds, type PopularGuildsQuery } from "./popular-guilds";
import {
  requestClassBuildCells,
  requestClassBuilds,
  requestClassBuildTop,
  type ClassBuildCellsQuery,
  type ClassBuildsQuery,
} from "./class-builds";
import { requestBestCombatPower } from "./best-combat-power";
import { requestGemLevels } from "./gem-levels";
import { requestLevelCombatPower } from "./level-combat-power";
import { requestGuildDetail, type GuildDetailQuery } from "./guild-detail";
import { requestTitleEquip, type TitleEquipQuery } from "./title-equip";
import { requestCollectibleRanking, type CollectibleQuery } from "./collectible-ranking";
import { requestPopulation } from "./population";

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

export function getPopularGuilds(query: PopularGuildsQuery, signal?: AbortSignal) {
  return requestPopularGuilds(query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getClassBuilds(query: ClassBuildsQuery, signal?: AbortSignal) {
  return requestClassBuilds(query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getClassBuildTop(query: ClassBuildsQuery, signal?: AbortSignal) {
  return requestClassBuildTop(query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getClassBuildCells(query: ClassBuildCellsQuery, signal?: AbortSignal) {
  return requestClassBuildCells(query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getTitleEquip(query: TitleEquipQuery, signal?: AbortSignal) {
  return requestTitleEquip(query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getBestCombatPower(query: StatsQuery, signal?: AbortSignal) {
  return requestBestCombatPower(query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getGemLevels(query: StatsQuery, signal?: AbortSignal) {
  return requestGemLevels(query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getLevelCombatPower(query: StatsQuery, signal?: AbortSignal) {
  return requestLevelCombatPower(query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getGuildDetail(query: GuildDetailQuery, signal?: AbortSignal) {
  return requestGuildDetail(query, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getPopulation(server: string | undefined, signal?: AbortSignal) {
  return requestPopulation(server, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}
