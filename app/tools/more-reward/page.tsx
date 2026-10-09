import type { Metadata } from "next";
import { MoreRewardTool } from "@/components/tools/more-reward";

export const metadata: Metadata = {
  title: "더보기 손익",
  description:
    "레이드 관문마다 더보기 골드와 받는 재료의 가치를 지금 거래소 시세로 비교해 이득인지 알려 줍니다.",
};

export default function MoreRewardPage() {
  return <MoreRewardTool />;
}
