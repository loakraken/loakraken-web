import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PriceAlertsView } from "@/components/market/price-alerts";
import { isPriceAlertsEnabled } from "@/lib/tools/flags";

export const metadata: Metadata = {
  title: "시세 알림",
  description: "로스트아크 거래소 품목의 판매 최저가가 정한 가격 이하나 이상이 되면 브라우저로 알려 드려요. 로그인 없이 쓸 수 있어요.",
  alternates: { canonical: "/market/alerts" },
};

// The flag is read per request (off on every deployment until it is opened).
export const dynamic = "force-dynamic";

export default function PriceAlertsPage() {
  if (!isPriceAlertsEnabled()) notFound();
  return <PriceAlertsView />;
}
