import type { BackendFailure, BackendResult } from "../api/backend";
import { statsSearch, type StatsEnvelopes, type StatsQuery, type StatsView } from "./model";
import {
  efficiencySearch,
  rankingSearch,
  type EfficiencyEnvelope,
  type EfficiencyKind,
  type EfficiencyQuery,
  type RankingEnvelope,
  type RankingQuery,
} from "./rankings";
import { rosterSearch, type RosterQuery, type RosterRankingEnvelope } from "./roster-ranking";
import { guildSearch, type GuildQuery, type GuildRankingEnvelope } from "./guild-ranking";
import { popularGuildsSearch, type PopularGuildsEnvelope, type PopularGuildsQuery } from "./popular-guilds";
import {
  classBuildCellsSearch,
  classBuildsSearch,
  type ClassBuildCellsEnvelope,
  type ClassBuildCellsQuery,
  type ClassBuildsEnvelope,
  type ClassBuildsQuery,
  type ClassBuildTopEnvelope,
} from "./class-builds";
import { bestCombatPowerSearch, type BestCombatPowerEnvelope } from "./best-combat-power";
import { gemLevelsSearch, type GemLevelsEnvelope } from "./gem-levels";
import { guildDetailPath, type GuildDetailEnvelope, type GuildDetailQuery } from "./guild-detail";
import { titleEquipSearch, type TitleEquipEnvelope, type TitleEquipQuery } from "./title-equip";
import { collectibleSearch, type CollectibleQuery, type CollectibleRankingEnvelope } from "./collectible-ranking";

export class StatsQueryError extends Error {
  info: BackendFailure;
  constructor(info: BackendFailure) {
    super(info.code);
    this.info = info;
  }
}

async function call<T>(path: string, signal: AbortSignal): Promise<T> {
  try {
    const response = await fetch(path, { signal, cache: "no-store" });
    const result: BackendResult<T> = await response.json();
    if (!result.ok) throw new StatsQueryError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof StatsQueryError || signal.aborted) throw error;
    throw new StatsQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}

export const fetchRankings = (query: RankingQuery, signal: AbortSignal) =>
  call<RankingEnvelope>(`/api/rankings?${rankingSearch(query)}`, signal);

export const fetchTitleEquip = (query: TitleEquipQuery, signal: AbortSignal) =>
  call<TitleEquipEnvelope>(`/api/titles/equipped?${titleEquipSearch(query)}`, signal);

export const fetchGuildRanking = (query: GuildQuery, signal: AbortSignal) =>
  call<GuildRankingEnvelope>(`/api/rankings/guilds?${guildSearch(query)}`, signal);

export const fetchPopularGuilds = (query: PopularGuildsQuery, signal: AbortSignal) =>
  call<PopularGuildsEnvelope>(`/api/guilds/popular?${popularGuildsSearch(query)}`, signal);

export const fetchClassBuilds = (query: ClassBuildsQuery, signal: AbortSignal) =>
  call<ClassBuildsEnvelope>(
    `/api/stats/classes/${encodeURIComponent(query.className)}/builds?${classBuildsSearch(query)}`,
    signal,
  );

export const fetchClassBuildTop = (query: ClassBuildsQuery, signal: AbortSignal) =>
  call<ClassBuildTopEnvelope>(
    `/api/stats/classes/${encodeURIComponent(query.className)}/builds/top?${classBuildsSearch(query)}`,
    signal,
  );

export const fetchClassBuildCells =(query: ClassBuildCellsQuery, signal: AbortSignal) =>
  call<ClassBuildCellsEnvelope>(
    `/api/stats/classes/${encodeURIComponent(query.className)}/builds/character?${classBuildCellsSearch(query)}`,
    signal,
  );

export const fetchRosterRanking = (query: RosterQuery, signal: AbortSignal) =>
  call<RosterRankingEnvelope>(`/api/rankings/rosters?${rosterSearch(query)}`, signal);

export const fetchCollectibleRanking = (query: CollectibleQuery, signal: AbortSignal) =>
  call<CollectibleRankingEnvelope>(`/api/rankings/collectibles?${collectibleSearch(query)}`, signal);

export async function fetchStats<V extends StatsView>(
  view: V,
  query: StatsQuery,
  signal: AbortSignal,
): Promise<StatsEnvelopes[V]> {
  try {
    const response = await fetch(`/api/stats/${view}?${statsSearch(query)}`, { signal, cache: "no-store" });
    const result: BackendResult<StatsEnvelopes[V]> = await response.json();
    if (!result.ok) throw new StatsQueryError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof StatsQueryError || signal.aborted) throw error;
    throw new StatsQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}

export const fetchEfficiencyRanking = (kind: EfficiencyKind, query: EfficiencyQuery, signal: AbortSignal) =>
  call<EfficiencyEnvelope>(`/api/rankings/efficiency?${efficiencySearch(kind, query)}`, signal);

export const fetchGemLevels = (query: StatsQuery, signal: AbortSignal) =>
  call<GemLevelsEnvelope>(`/api/stats/gem-levels?${gemLevelsSearch(query)}`, signal);

export const fetchBestCombatPower = (query: StatsQuery, signal: AbortSignal) =>
  call<BestCombatPowerEnvelope>(`/api/stats/best-combat-power?${bestCombatPowerSearch(query)}`, signal);
export const fetchGuildDetail = (query: GuildDetailQuery, signal: AbortSignal) =>
  call<GuildDetailEnvelope>(guildDetailPath(query), signal);
