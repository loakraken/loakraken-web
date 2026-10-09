import type { Metadata } from "next";
import { RankingsView } from "@/components/stats/rankings-view";
import { parseRankingQuery } from "@/lib/stats/rankings";

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
  // Invalid values in a shared link fall back to the defaults.
  const query = parseRankingQuery(params) ?? { metric: "COMBAT_POWER" as const, page: 1 };
  return <RankingsView initial={query} />;
}
