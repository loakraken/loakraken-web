import type { Metadata } from "next";
import { MultiSearchView } from "@/components/multi-search/multi-search-view";
import { namesFromParam } from "@/lib/multi-search/model";

export const metadata: Metadata = {
  title: "멀티서치",
  description:
    "로스트아크 캐릭터 여러 명을 나란히 놓고 아이템 레벨·전투력·각인·아크 패시브·장비·보석을 한 번에 비교합니다.",
  alternates: { canonical: "/multi-search" },
};

export default async function MultiSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).names;
  // Invalid names in a shared link are dropped; the rest load one by one.
  return <MultiSearchView initialNames={namesFromParam(typeof raw === "string" ? raw : null)} />;
}
