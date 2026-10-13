import { toResponse } from "@/lib/api/respond";
import { parsePopularGuildsQuery } from "@/lib/stats/popular-guilds";
import { getPopularGuilds } from "@/lib/stats/server";

export async function GET(request: Request) {
  return toResponse(await getPopularGuilds(parsePopularGuildsQuery(new URL(request.url).searchParams), request.signal));
}
