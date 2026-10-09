import type { Metadata } from "next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { MarketBoardView } from "@/components/market/market-board";
import { boardQueryString, parseItemId, readBoardQuery } from "@/lib/market/board";
import { getItemHistory, getMarketBoard, getMarketTabs } from "@/lib/market/server";

export const metadata: Metadata = {
  title: "시세",
  description:
    "로스트아크 공식 거래소 시세를 분류별로 모아 보여줍니다. 현재 최저가, 전일 평균 대비 등락, 최근 14일 평균 거래가와 거래량을 확인하세요.",
  alternates: { canonical: "/market" },
};

// Prices change through the day: render per request so the first HTML carries
// the categories, the board and the chosen item's history (no layout shift).
export const dynamic = "force-dynamic";

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const item = typeof params.item === "string" ? parseItemId(params.item) : null;
  const initial = readBoardQuery(params);
  // A slow backend must not hold the first HTML: one 1s deadline for all three
  // calls together; whatever is missing the client fetches into placeholders
  // that already have the final sizes (#213), so the page never shifts.
  const deadline = AbortSignal.timeout(1_000);
  const [tabs, board] = await Promise.all([
    getMarketTabs(deadline),
    getMarketBoard(new URLSearchParams(boardQueryString(initial)), deadline),
  ]);
  const first = item ?? (board.ok ? board.envelope.data.items[0]?.itemId : undefined);
  const history = first != null ? await getItemHistory(String(first), deadline).catch(() => null) : null;
  // Request-time snapshot in a dynamic Server Component, shared with hydration.
  // eslint-disable-next-line react-hooks/purity
  const fetchedAt = Date.now();
  const client = new QueryClient();
  if (tabs.ok) client.setQueryData(["market", "tabs"], tabs.envelope, { updatedAt: fetchedAt });
  if (board.ok) client.setQueryData(["market", "board", initial], board.envelope, { updatedAt: fetchedAt });
  if (history?.ok && first != null)
    client.setQueryData(["market", "history", first], history.envelope, { updatedAt: fetchedAt });
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <MarketBoardView initial={initial} initialItem={item} />
    </HydrationBoundary>
  );
}
