import type { Metadata } from "next";
import { RankingsView } from "@/components/stats/rankings-view";
import { RosterRankingsView } from "@/components/stats/roster-rankings-view";
import { GuildRankingsView } from "@/components/stats/guild-rankings-view";
import { CollectibleRankingsView } from "@/components/stats/collectible-rankings-view";
import { EfficiencyRankingsView } from "@/components/stats/efficiency-rankings-view";
import type { RankingType } from "@/components/stats/ranking-type-tabs";
import { parseCollectibleQuery } from "@/lib/stats/collectible-ranking";
import { parseRosterQuery } from "@/lib/stats/roster-ranking";
import { parseGuildQuery } from "@/lib/stats/guild-ranking";
import {
  isCollectibleRankingEnabled,
  isEfficiencyRankingEnabled,
  isGuildRankingEnabled,
  isPopularGuildsEnabled,
  isRosterRankingEnabled,
} from "@/lib/tools/flags";
import { parseEfficiencyQuery, parseRankingQuery } from "@/lib/stats/rankings";

export const metadata: Metadata = {
  title: "랭킹",
  description:
    "LOAKraken이 확인한 로스트아크 캐릭터의 전투력·아이템 레벨 랭킹입니다. 서버·직업·역할로 걸러 보고, 상위 백분위와 티어를 확인하세요.",
  alternates: { canonical: "/rankings" },
};

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") params.set(key, value);
  // ?type=roster opens the roster ranking (ROSTER_RANKING), ?type=collectibles
  // the collectible ranking (COLLECTIBLE_RANKING). A hidden one falls back to
  // the character ranking; with neither on, there are no type tabs.
  const types: RankingType[] = [
    "character",
    ...(isRosterRankingEnabled() ? (["roster"] as const) : []),
    // 길드 랭킹 (api #302, GUILD_RANKING).
    ...(isGuildRankingEnabled() ? (["guilds"] as const) : []),
    ...(isCollectibleRankingEnabled() ? (["collectibles"] as const) : []),
    // 팔찌·젬 효율 랭킹 (api #444, EFFICIENCY_RANKING).
    ...(isEfficiencyRankingEnabled() ? (["bracelets", "gems"] as const) : []),
  ];
  const type = types.find((t) => t === params.get("type")) ?? "character";
  if (type === "roster") return <RosterRankingsView initial={parseRosterQuery(params)} types={types} />;
  if (type === "guilds") return <GuildRankingsView initial={parseGuildQuery(params)} types={types} popular={isPopularGuildsEnabled()} />;
  if (type === "collectibles") return <CollectibleRankingsView initial={parseCollectibleQuery(params)} types={types} />;
  if (type === "bracelets" || type === "gems")
    return <EfficiencyRankingsView kind={type} initial={parseEfficiencyQuery(params)} types={types} />;
  // Invalid values in a shared link fall back to the defaults.
  const query = parseRankingQuery(params) ?? { metric: "COMBAT_POWER" as const, page: 1 };
  return <RankingsView initial={query} types={types} />;
}
