import type { Metadata } from "next";
import { LifeEnergyTool } from "@/components/tools/life-energy";

export const metadata: Metadata = {
  title: "생명의 기운 효율",
  description:
    "쓸 생명의 기운으로 생활 스킬마다 버는 골드를 재료 판매와 융화 재료 제작 중 큰 쪽으로 지금 거래소 시세에 맞춰 계산합니다.",
};

export default function LifeEnergyPage() {
  return <LifeEnergyTool />;
}
