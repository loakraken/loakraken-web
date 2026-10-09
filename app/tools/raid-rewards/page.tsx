import type { Metadata } from "next";
import { RaidRewardsTable } from "@/components/tools/raid-rewards";

export const metadata: Metadata = {
  title: "레이드 보상표",
  description:
    "카제로스·그림자·에픽 레이드와 익스트림의 관문별 클리어 골드, 귀속 골드, 더보기 비용을 공식 공지 기준으로 정리했습니다.",
};

export default function RaidRewardsPage() {
  return <RaidRewardsTable />;
}
