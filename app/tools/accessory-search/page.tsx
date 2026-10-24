import { permanentRedirect } from "next/navigation";

// 악세 경매 검색 moved to the 시세 tab (user 10-24): old and shared links
// (with their conditions in the query) go there for good (308).
export default async function OldAccessorySearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const one of Array.isArray(value) ? value : value == null ? [] : [value]) params.append(key, one);
  permanentRedirect(params.size ? `/market/accessory-search?${params}` : "/market/accessory-search");
}
