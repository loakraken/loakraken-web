import { toResponse } from "@/lib/api/respond";
import { isSameSite } from "@/lib/api/same-site";
import { refreshRosterPower } from "@/lib/character/server";

// POST only: reading the profiles spends official calls, so a GET (prefetch, crawler) never triggers it.
export async function POST(request: Request) {
  if (!isSameSite(request))
    return toResponse({ ok: false, error: { code: "INVALID_REQUEST", status: 403 } });
  const params = new URL(request.url).searchParams;
  return toResponse(await refreshRosterPower(params.get("characterName") ?? "", request.signal));
}
