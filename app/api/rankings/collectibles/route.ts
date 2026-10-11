import { toResponse } from "@/lib/api/respond";
import { parseCollectibleQuery } from "@/lib/stats/collectible-ranking";
import { getCollectibleRanking } from "@/lib/stats/server";

export async function GET(request: Request) {
  return toResponse(await getCollectibleRanking(parseCollectibleQuery(new URL(request.url).searchParams), request.signal));
}
