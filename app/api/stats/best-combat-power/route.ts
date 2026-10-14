import { toResponse } from "@/lib/api/respond";
import { parseStatsQuery } from "@/lib/stats/model";
import { getBestCombatPower } from "@/lib/stats/server";

export async function GET(request: Request) {
  const query = parseStatsQuery(new URL(request.url).searchParams);
  if (!query) return toResponse({ ok: false, error: { code: "INVALID_REQUEST", status: 400 } });
  return toResponse(await getBestCombatPower(query, request.signal));
}
