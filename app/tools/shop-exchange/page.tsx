import type { Metadata } from "next";
import { connection } from "next/server";
import { ShopExchangeTool } from "@/components/tools/shop-exchange";

export const metadata: Metadata = {
  title: "상점 교환 효율",
  description:
    "레이드 재화 · 싱글 상점 · 길드 혈석 교환 품목마다 재화 1개로 얻는 골드 가치를 지금 거래소 시세로 계산합니다.",
  alternates: { canonical: "/tools/shop-exchange" },
};

export default async function ShopExchangePage() {
  // Rendered per request: the inputs kept in the address (#889) are in the first HTML.
  await connection();
  return <ShopExchangeTool />;
}
