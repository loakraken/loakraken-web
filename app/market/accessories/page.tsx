import type { Metadata } from "next";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { AccessoryBoardView } from "@/components/market/accessory-board";
import { parseAccessoryFilter, parseAccessoryPick } from "@/lib/market/auction-accessories";
import { getAccessoryBoard } from "@/lib/market/server";

export const metadata: Metadata = {
  title: "장신구 시세",
  description:
    "로스트아크 경매장 4티어 장신구를 부위별 핵심 연마 효과의 등급 조합으로 나눈 즉시 구매 최저가, 전일 대비, 매물 수와 싼 매물 목록입니다.",
  alternates: { canonical: "/market/accessories" },
};

export const dynamic = "force-dynamic";

export default async function AccessoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") params.set(key, value);
  const filter = parseAccessoryFilter(params);
  // A slow backend gives up after 1s; the client then fetches into the held room (CLS).
  const board = await getAccessoryBoard(filter, AbortSignal.timeout(1_000));
  // eslint-disable-next-line react-hooks/purity
  const fetchedAt = Date.now();
  const client = new QueryClient();
  if (board.ok) client.setQueryData(["accessory-board", filter], board.envelope, { updatedAt: fetchedAt });
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <AccessoryBoardView initialFilter={filter} initialPick={parseAccessoryPick(params)} />
    </HydrationBoundary>
  );
}
