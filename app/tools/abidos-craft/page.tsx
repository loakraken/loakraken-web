import type { Metadata } from "next";
import { AbidosCraftTool } from "@/components/tools/abidos-craft";

export const metadata: Metadata = {
  title: "아비도스 제작 손익",
  description:
    "아비도스·상급 아비도스 융화 재료를 생활 스킬별로 1회 제작할 때의 비용과 손익을 지금 거래소 시세로 계산합니다.",
  alternates: { canonical: "/tools/abidos-craft" },
};

export default function AbidosCraftPage() {
  return <AbidosCraftTool />;
}
