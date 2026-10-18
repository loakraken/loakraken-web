import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccessorySearchTool } from "@/components/tools/accessory-search";
import { isAccessorySearchEnabled } from "@/lib/tools/flags";

export const metadata: Metadata = {
  title: "악세 경매 검색",
  description: "연마 효과·깨달음·힘민지 범위·품질 조건으로 T4 장신구 경매 매물을 즉시 구매가 순으로 찾습니다.",
  alternates: { canonical: "/tools/accessory-search" },
};

// The flag is read per request (hidden on production until opened).
export const dynamic = "force-dynamic";

export default function AccessorySearchPage() {
  if (!isAccessorySearchEnabled()) notFound();
  return <AccessorySearchTool />;
}
