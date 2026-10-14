import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { ClassBuildsView } from "@/components/stats/class-builds-view";
import { classBuildCellsKey, classBuildsKey, classBuildTopKey, parseClassBuildsQuery } from "@/lib/stats/class-builds";
import { getClassBuildCells, getClassBuilds, getClassBuildTop } from "@/lib/stats/server";
import { parseCompareCharacter } from "@/lib/stats/build-compare";

type Props = {
  params: Promise<{ className: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const className = decodeURIComponent((await params).className);
  return {
    title: `${className} 직업 통계`,
    description: `LOAKraken이 확인한 로스트아크 ${className} 캐릭터의 직업 각인, 각인 조합, 아크 패시브 포인트, 보석, 카드 세트, 주력 특성과 팔찌 특성 통계입니다.`,
    alternates: { canonical: `/stats/classes/${encodeURIComponent(className)}` },
  };
}

export default async function ClassBuildsPage({ params, searchParams }: Props) {
  const className = decodeURIComponent((await params).className);
  const raw = await searchParams;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") search.set(key, value);
  const query = parseClassBuildsQuery(className, search);
  if (!query) notFound();
  // 대세 빌드 비교 (M26): the character to compare, when the address names one.
  const compare = parseCompareCharacter(search.get("character"));
  const cellsQuery = compare ? { className: query.className, characterName: compare, activeDays: query.activeDays } : null;
  // The sections (and the character's cells) come in the first HTML (no
  // shift when they land); a slow backend gives up after 1s and the client
  // fetches as before.
  const [result, cells, top] = await Promise.all([
    getClassBuilds(query, AbortSignal.timeout(1_000)),
    cellsQuery ? getClassBuildCells(cellsQuery, AbortSignal.timeout(1_000)) : null,
    getClassBuildTop(query, AbortSignal.timeout(1_000)),
  ]);
  // eslint-disable-next-line react-hooks/purity
  const fetchedAt = Date.now();
  const client = new QueryClient();
  if (result.ok) client.setQueryData(classBuildsKey(query), result.envelope, { updatedAt: fetchedAt });
  if (top.ok) client.setQueryData(classBuildTopKey(query), top.envelope, { updatedAt: fetchedAt });
  if (cellsQuery && cells?.ok) client.setQueryData(classBuildCellsKey(cellsQuery), cells.envelope, { updatedAt: fetchedAt });
  // Not recorded: said in the first HTML too (an error is not carried by the
  // query cache, and "loading" then the two-line notice moved the cards, A6).
  const compareMissing = !!cells && !cells.ok && cells.error.code === "CHARACTER_NOT_CACHED";
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <ClassBuildsView initial={query} compare={compare} compareMissing={compareMissing} />
    </HydrationBoundary>
  );
}
