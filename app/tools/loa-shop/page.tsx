import type { Metadata } from "next";
import { LoaShopTool } from "@/components/tools/loa-shop";

export const metadata: Metadata = {
  title: "로아샵 효율",
  description:
    "게임 안 상점 패키지의 구성품을 지금 거래소 시세로 매기고, 공식 크리스탈 경로로 판매가와 비교합니다.",
  alternates: { canonical: "/tools/loa-shop" },
};

// Rendered per request so the packages whose sale has ended are folded away
// in the first HTML, decided by the time of the request (A6).
export const dynamic = "force-dynamic";

export default function LoaShopPage() {
  // Request-time snapshot in a dynamic Server Component, shared with hydration.
  // eslint-disable-next-line react-hooks/purity
  const renderedAt = Date.now();
  return <LoaShopTool renderedAt={renderedAt} />;
}
