import type { Metadata } from "next";
import { NOT_FOUND_METADATA } from "@/lib/not-found-metadata";
import { notFound } from "next/navigation";
import { AccessorySearchTool } from "@/components/tools/accessory-search";
import { isAccessorySearchEnabled } from "@/lib/tools/flags";

const metadata: Metadata = {
  title: "악세 경매 검색",
  description: "연마 효과·깨달음·힘민지 범위·품질 조건으로 T4 장신구 경매 매물을 즉시 구매가 순으로 찾습니다.",
  alternates: { canonical: "/market/accessory-search" },
};

// Hidden by its switch: the 404's title, not this tool's name.
export function generateMetadata(): Metadata {
  return isAccessorySearchEnabled() ? metadata : NOT_FOUND_METADATA;
}

// The flag is read per request (hidden on production until opened).
export const dynamic = "force-dynamic";

export default function AccessorySearchPage() {
  if (!isAccessorySearchEnabled()) notFound();
  return <AccessorySearchTool />;
}
