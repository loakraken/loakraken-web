import "server-only";
import type { StatsQuery, StatsView } from "./model";
import { requestStats } from "./upstream";
import { type EfficiencyKind, type EfficiencyQuery, type RankingQuery } from "./rankings";
import { requestEfficiencyRanking, requestRankings } from "./rankings.backend";
import { type RosterQuery } from "./roster-ranking";
import { requestRosterRanking } from "./roster-ranking.backend";
import { type GuildQuery } from "./guild-ranking";
import { requestGuildRanking } from "./guild-ranking.backend";
import { type PopularGuildsQuery } from "./popular-guilds";
import { requestPopularGuilds } from "./popular-guilds.backend";
import { type ClassBuildCellsQuery, type ClassBuildsQuery } from "./class-builds";
import { requestClassBuildCells, requestClassBuilds, requestClassBuildTop } from "./class-builds.backend";
import { requestBestCombatPower } from "./best-combat-power.backend";
import { type GuildDetailQuery } from "./guild-detail";
import { requestGuildDetail } from "./guild-detail.backend";
import { type TitleEquipQuery } from "./title-equip";
import { requestTitleEquip } from "./title-equip.backend";
import { type CollectibleQuery } from "./collectible-ranking";
import { requestCollectibleRanking } from "./collectible-ranking.backend";
import { requestGemLevels } from "./gem-levels";
import { requestLevelCombatPower } from "./level-combat-power";
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
