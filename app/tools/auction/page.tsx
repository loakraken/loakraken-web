import type { Metadata } from "next";
import { AuctionBidTool } from "@/components/tools/auction-bid";
import { readAuctionParams } from "@/lib/tools/auction";

export const metadata: Metadata = {
  title: "경매 입찰가 계산",
  description:
    "레이드 경매에서 아이템 가격과 파티 인원으로 판매·직접 사용 손익 분기와 선점 입찰가, 1인 분배금을 계산합니다.",
  alternates: { canonical: "/tools/auction" },
};

export default async function AuctionPage({
  searchParams,
}: {
  searchParams: Promise<{ price?: string | string[]; party?: string | string[] }>;
}) {
  const { price, party } = readAuctionParams(await searchParams);
  return <AuctionBidTool initialPrice={price} initialParty={party} />;
}
