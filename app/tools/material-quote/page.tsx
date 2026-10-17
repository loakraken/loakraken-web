import type { Metadata } from "next";
import { MaterialQuoteTool } from "@/components/tools/material-quote";

export const metadata: Metadata = {
  title: "재료 구매 견적",
  description:
    "필요한 재료와 보유 수량을 입력하면 공식 거래소 묶음 시세로 추가 구매 골드를 계산합니다.",
  alternates: { canonical: "/tools/material-quote" },
};

export default async function MaterialQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  // A shared link keeps its category (PM-프론트 09:25 딥링크 선택 유지).
  const { category } = await searchParams;
  const code = typeof category === "string" ? Number(category) : NaN;
  return <MaterialQuoteTool initialCategory={Number.isInteger(code) && code > 0 ? code : null} />;
}
