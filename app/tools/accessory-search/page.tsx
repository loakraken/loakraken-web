import { notFound, permanentRedirect } from "next/navigation";
import { isAccessorySearchEnabled } from "@/lib/tools/flags";

// 악세 경매 검색 moved to the 시세 tab (user 10-24), then into the 장신구 tab
// (user 11-02): old and shared links (with their conditions in the query) go
// there for good in one step (308). Where the tool is switched off this stays
// a plain 404, not a redirect into one.
export default async function OldAccessorySearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isAccessorySearchEnabled()) notFound();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const one of Array.isArray(value) ? value : value == null ? [] : [value]) params.append(key, one);
  permanentRedirect(params.size ? `/market/accessories/search?${params}` : "/market/accessories/search");
}
