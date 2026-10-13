import type { Metadata } from "next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { StatsView } from "@/components/stats/stats-view";
import { getStats } from "@/lib/stats/server";
import { isTitleStatsEnabled } from "@/lib/tools/flags";
import { parseStatsQuery, statsKey, type StatsQuery } from "@/lib/stats/model";

export const metadata: Metadata = {
  title: "통계",
  description:
    "LOAKraken이 확인한 로스트아크 캐릭터의 직업별 인원과 전투력 분포, 아이템 레벨·전투력 분포와 백분위, 서버별 중앙값을 보여줍니다.",
  alternates: { canonical: "/stats" },
};

const TABS = ["classes", "distribution", "servers", "titles"] as const;

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") params.set(key, value);
  // ?tab=titles only while the title shares are on (TITLE_STATS).
  const titles = isTitleStatsEnabled();
  const tab = TABS.filter((t) => titles || t !== "titles").find((t) => t === params.get("tab")) ?? "classes";
  params.delete("tab");
  // Invalid filters in a shared link fall back to the defaults.
  const query: StatsQuery = parseStatsQuery(params) ?? {};
  delete query.metric;
  delete query.width;
  delete query.percentileOf;
  // The summary cards sit above the tabs: arriving after hydration they pushed
  // the tabs and table down (CLS 0.12 at 390). The summary and the table of a
  // classes/servers tab come in the first HTML; a slow backend gives up after
  // 1s and the client fetches as before.
  const deadline = AbortSignal.timeout(1_000);
  const view = tab === "classes" || tab === "servers" ? tab : null;
  const [summary, table] = await Promise.all([
    getStats("summary", query, deadline),
    view ? getStats(view, query, deadline) : null,
  ]);
  // eslint-disable-next-line react-hooks/purity
  const fetchedAt = Date.now();
  const client = new QueryClient();
  if (summary.ok) client.setQueryData(["stats", "summary", statsKey(query)], summary.envelope, { updatedAt: fetchedAt });
  if (view && table?.ok) client.setQueryData(["stats", view, statsKey(query)], table.envelope, { updatedAt: fetchedAt });
  // StatsView follows initialTab itself, so a menu link to another tab opens it.
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <StatsView initial={query} initialTab={tab} titles={titles} />
    </HydrationBoundary>
  );
}
