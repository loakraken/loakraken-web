import { parseGemPick } from "@/lib/market/auction-gems";
import { getGemListings, toResponse } from "@/lib/market/server";

export async function GET(request: Request) {
  const pick = parseGemPick(new URL(request.url).searchParams);
  if (!pick) return toResponse({ ok: false, error: { code: "INVALID_REQUEST", status: 400 } });
  return toResponse(await getGemListings(pick, request.signal));
}
