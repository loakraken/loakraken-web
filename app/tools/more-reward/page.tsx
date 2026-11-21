import type { Metadata } from "next";
import { connection } from "next/server";
import { MoreRewardTool } from "@/components/tools/more-reward";

export const metadata: Metadata = {
  title: "더보기 손익",
  description:
    "레이드 관문마다 더보기 골드와 받는 재료의 가치를 지금 거래소 시세로 비교해 이득인지 알려 줍니다.",
  alternates: { canonical: "/tools/more-reward" },
};

export default async function MoreRewardPage() {
  // Rendered per request: the price basis and bound-gold switch kept in the address (M51) are in the first HTML.
  await connection();
  return <MoreRewardTool />;
}
