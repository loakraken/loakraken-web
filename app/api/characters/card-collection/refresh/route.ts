import { toResponse } from "@/lib/api/respond";
import { refreshCardCollection } from "@/lib/character/server";

// POST only: a refill spends official calls, so a GET (prefetch, crawler) never triggers it.
export async function POST(request: Request) {
  const params = new URL(request.url).searchParams;
  return toResponse(await refreshCardCollection(params.get("characterName") ?? "", request.signal));
}
