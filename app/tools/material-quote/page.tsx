import { permanentRedirect } from "next/navigation";

// 재료 구매 견적 moved to the 시세 hub (메뉴 합치기, 사용자 승인 10-26): old and
// shared links (with their category in the query) go there for good (308).
export default async function OldMaterialQuotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const one of Array.isArray(value) ? value : value == null ? [] : [value]) params.append(key, one);
  permanentRedirect(params.size ? `/market/quote?${params}` : "/market/quote");
}