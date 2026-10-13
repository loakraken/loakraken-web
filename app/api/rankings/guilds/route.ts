import { toResponse } from "@/lib/api/respond";
import { parseGuildQuery } from "@/lib/stats/guild-ranking";
import { getGuildRanking } from "@/lib/stats/server";

export async function GET(request: Request) {
  return toResponse(await getGuildRanking(parseGuildQuery(new URL(request.url).searchParams), request.signal));
}
