import type { Metadata } from "next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { NewsPage } from "@/components/news/news-page";
import { readNewsQuery } from "@/lib/home/news";
import { NEWS_PAGE_LIMIT, newsPageKey, patchNotesKey } from "@/lib/home/client";
import { getNews, getPatchNotes } from "@/lib/home/server";

export const metadata: Metadata = {
  title: "공지·이벤트",
  description:
    "로스트아크 공식 공지사항(점검·이벤트·상점), 업데이트·밸런스·클라이언트 패치 이력, 진행 중인 이벤트와 남은 기간을 한곳에서 확인하세요.",
  alternates: { canonical: "/news" },
};

// Notices change through the day: render per request so the first HTML
// carries the list (the backend caches news 10 minutes).
export const dynamic = "force-dynamic";

export default async function News({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { tab, patchKind } = readNewsQuery({
    get: (name) => (typeof params[name] === "string" ? (params[name] as string) : null),
  });
  // A slow backend must not hold the first HTML: one 1s deadline for both calls.
  const deadline = AbortSignal.timeout(1_000);
  const [news, patches] = await Promise.all([
    getNews(NEWS_PAGE_LIMIT, { signal: deadline }),
    tab === "patch"
      ? getPatchNotes({ category: patchKind, page: 1 }, { signal: deadline })
      : null,
  ]);
  // Request-time snapshot in a dynamic Server Component, shared with hydration.
  // eslint-disable-next-line react-hooks/purity
  const fetchedAt = Date.now();
  const client = new QueryClient();
  if (news.ok) client.setQueryData(newsPageKey, news.envelope, { updatedAt: fetchedAt });
  if (patches?.ok)
    client.setQueryData(
      patchNotesKey(patchKind),
      { pages: [patches.envelope], pageParams: [1] },
      { updatedAt: fetchedAt },
    );
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <NewsPage renderedAt={fetchedAt} />
    </HydrationBoundary>
  );
}
