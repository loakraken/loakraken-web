import type { Metadata } from "next";
import { StatsView } from "@/components/stats/stats-view";
import { parseStatsQuery, type StatsQuery } from "@/lib/stats/model";

export const metadata: Metadata = {
  title: "통계",
  description:
    "LOAKraken이 확인한 로스트아크 캐릭터의 직업별 인원과 전투력 분포, 아이템 레벨·전투력 분포와 백분위, 서버별 중앙값을 보여줍니다.",
  alternates: { canonical: "/stats" },
};

const TABS = ["classes", "distribution", "servers"] as const;

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") params.set(key, value);
  const tab = TABS.find((t) => t === params.get("tab")) ?? "classes";
  params.delete("tab");
  // Invalid filters in a shared link fall back to the defaults.
  const query: StatsQuery = parseStatsQuery(params) ?? {};
  delete query.metric;
  delete query.width;
  delete query.percentileOf;
  // Keyed by tab so a menu link to another tab opens it.
  return <StatsView key={tab} initial={query} initialTab={tab} />;
}
