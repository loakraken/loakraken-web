import { parseAccessoryFilter, parseAccessoryPick } from "@/lib/market/auction-accessories";
import { getAccessoryListings, toResponse } from "@/lib/market/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const pick = parseAccessoryPick(params);
  if (!pick) return toResponse({ ok: false, error: { code: "INVALID_REQUEST", status: 400 } });
  return toResponse(await getAccessoryListings(parseAccessoryFilter(params), pick, request.signal));
}
