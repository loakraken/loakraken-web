import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { HomeDashboard } from "@/components/home/home";
import { homeNewsKey, homeScheduleKey } from "@/lib/home/client";
import { getNews, getSchedule } from "@/lib/home/server";
import { getPopular } from "@/lib/character/server";
import { getMarketBoard } from "@/lib/market/server";
import { getPopularGuilds, getStats } from "@/lib/stats/server";
import { GUILD_PERIOD_PARAM, popularGuildsPeriodOf } from "@/lib/stats/popular-guilds";
import { isPopularGuildsEnabled } from "@/lib/tools/flags";

// Schedule and notices change through the day; render per request so the
// first HTML already carries them (the backend caches 30 / 10 minutes).
export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // 인기 길드 opens on the period in the address (?guildPeriod=7d).
  const guildParam = (await searchParams)[GUILD_PERIOD_PARAM];
  const guildPeriod = popularGuildsPeriodOf(typeof guildParam === "string" ? guildParam : null);
  // A slow backend must not hold the first HTML: give up after 2.5s and let
  // the client fetch instead.
  const prefetch = { timeoutMs: 2_500 };
  const deadline = AbortSignal.timeout(prefetch.timeoutMs);
  const popularGuilds = isPopularGuildsEnabled();
  const [schedule, news, popular, market, servers, guilds] = await Promise.all([
    getSchedule(null, prefetch),
    getNews(15, prefetch),
    // The popular list (aside, near the top on phones) also comes in the first
    // HTML so it does not push the cards below when it arrives (CLS).
    getPopular("24h", 10, deadline),
    // The market summary and server info too: every card that would otherwise
    // grow after hydration and push the next ones down.
    getMarketBoard(new URLSearchParams({ tab: "REFINING" }), deadline),
    getStats("servers", {}, deadline),
    // 인기 길드 (POPULAR_GUILDS) under the popular characters, in the first HTML too.
    popularGuilds ? getPopularGuilds({ period: guildPeriod }, deadline) : null,
  ]);
  // Request-time snapshot in a dynamic Server Component, shared with hydration.
  // eslint-disable-next-line react-hooks/purity
  const fetchedAt = Date.now();
  const client = new QueryClient();
  if (schedule.ok)
    client.setQueryData(homeScheduleKey(null), schedule.envelope, { updatedAt: fetchedAt });
  if (news.ok) client.setQueryData(homeNewsKey, news.envelope, { updatedAt: fetchedAt });
  if (popular.ok) client.setQueryData(["home-popular", "24h"], popular.envelope, { updatedAt: fetchedAt });
  if (market.ok) client.setQueryData(["home-market"], market.envelope, { updatedAt: fetchedAt });
  if (servers.ok) client.setQueryData(["stats", "servers", {}], servers.envelope, { updatedAt: fetchedAt });
  if (guilds?.ok) client.setQueryData(["popular-guilds", guildPeriod, null], guilds.envelope, { updatedAt: fetchedAt });
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <HomeDashboard renderedAt={fetchedAt} popularGuilds={popularGuilds} />
    </HydrationBoundary>
  );
}
