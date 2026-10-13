import type { Metadata } from "next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { GemBoardView } from "@/components/market/gem-board";
import { parseGemPick } from "@/lib/market/auction-gems";
import { getGemBoard } from "@/lib/market/server";

export const metadata: Metadata = {
  title: "보석 시세",
  description: "로스트아크 경매장 4티어 겁화·작열 보석의 레벨별 즉시 구매 최저가, 전일 대비, 매물 수와 싼 매물 목록입니다.",
  alternates: { canonical: "/market/gems" },
};

// Prices change through the day: render per request so the first HTML carries the board.
export const dynamic = "force-dynamic";

export default async function GemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") params.set(key, value);
  // A slow backend gives up after 1s; the client then fetches into the same-sized board (CLS).
  const board = await getGemBoard(AbortSignal.timeout(1_000));
  // eslint-disable-next-line react-hooks/purity
  const fetchedAt = Date.now();
  const client = new QueryClient();
  if (board.ok) client.setQueryData(["gem-board"], board.envelope, { updatedAt: fetchedAt });
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <GemBoardView initialPick={parseGemPick(params)} />
    </HydrationBoundary>
  );
}
