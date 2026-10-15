import type { Metadata } from "next";
import { connection } from "next/server";
import { MultiSearchView } from "@/components/multi-search/multi-search-view";

export const metadata: Metadata = {
  title: "멀티서치",
  description:
    "로스트아크 캐릭터 여러 명을 나란히 놓고 아이템 레벨·전투력·각인·아크 패시브·장비·보석을 한 번에 비교합니다.",
  alternates: { canonical: "/multi-search" },
};

export default async function MultiSearchPage() {
  // Rendered per request, so a shared link's names (?names=, read by the
  // view itself) are in the first HTML. Invalid names in it are dropped.
  await connection();
  return <MultiSearchView />;
}
