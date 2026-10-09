import type { Metadata } from "next";
import { MarketBoardView } from "@/components/market/market-board";
import { parseItemId, readBoardQuery } from "@/lib/market/board";

export const metadata: Metadata = {
  title: "시세",
  description:
    "로스트아크 공식 거래소 시세를 분류별로 모아 보여줍니다. 현재 최저가, 전일 평균 대비 등락, 최근 14일 평균 거래가와 거래량을 확인하세요.",
  alternates: { canonical: "/market" },
};

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const item = typeof params.item === "string" ? parseItemId(params.item) : null;
  return <MarketBoardView initial={readBoardQuery(params)} initialItem={item} />;
}
