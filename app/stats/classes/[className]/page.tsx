import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { ClassBuildsView } from "@/components/stats/class-builds-view";
import { classBuildsKey, parseClassBuildsQuery } from "@/lib/stats/class-builds";
import { getClassBuilds } from "@/lib/stats/server";
import { getCharacter } from "@/lib/character/server";
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
  // The sections (and the character to compare) come in the first HTML (no
  // shift when they land); a slow backend gives up after 1s and the client
  // fetches as before.
  const [result, character] = await Promise.all([
    getClassBuilds(query, AbortSignal.timeout(1_000)),
    compare ? getCharacter(compare, AbortSignal.timeout(1_000)) : null,
  ]);
  // eslint-disable-next-line react-hooks/purity
  const fetchedAt = Date.now();
  const client = new QueryClient();
  if (result.ok) client.setQueryData(classBuildsKey(query), result.envelope, { updatedAt: fetchedAt });
  if (compare && character?.ok) client.setQueryData(["character", compare], character.envelope, { updatedAt: fetchedAt });
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <ClassBuildsView initial={query} compare={compare} />
    </HydrationBoundary>
  );
}
