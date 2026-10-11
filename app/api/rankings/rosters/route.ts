import { toResponse } from "@/lib/api/respond";
import { parseRosterQuery } from "@/lib/stats/roster-ranking";
import { getRosterRanking } from "@/lib/stats/server";

export async function GET(request: Request) {
  return toResponse(await getRosterRanking(parseRosterQuery(new URL(request.url).searchParams), request.signal));
}
