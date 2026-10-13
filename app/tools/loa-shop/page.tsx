import type { Metadata } from "next";
import { LoaShopTool } from "@/components/tools/loa-shop";

export const metadata: Metadata = {
  title: "로아샵 효율",
  description:
    "게임 안 상점 패키지의 구성품을 지금 거래소 시세로 매기고, 공식 크리스탈 경로로 판매가와 비교합니다.",
};

export default function LoaShopPage() {
  return <LoaShopTool />;
}
