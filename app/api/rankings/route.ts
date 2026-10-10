import { toResponse } from "@/lib/api/respond";
import { parseRankingQuery } from "@/lib/stats/rankings";
import { getRankings } from "@/lib/stats/server";

const invalid = { ok: false as const, error: { code: "INVALID_REQUEST", status: 400 } };

export async function GET(request: Request) {
  const query = parseRankingQuery(new URL(request.url).searchParams);
  if (!query) return toResponse(invalid);
  return toResponse(await getRankings(query, request.signal));
}
