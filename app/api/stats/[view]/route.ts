import { toResponse } from "@/lib/api/respond";
import { STATS_VIEWS, parseStatsQuery, type StatsView } from "@/lib/stats/model";
import { getStats } from "@/lib/stats/server";

const invalid = { ok: false as const, error: { code: "INVALID_REQUEST", status: 400 } };

export async function GET(request: Request, { params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  const query = parseStatsQuery(new URL(request.url).searchParams);
  if (!(STATS_VIEWS as readonly string[]).includes(view) || !query) return toResponse(invalid);
  return toResponse(await getStats(view as StatsView, query, request.signal));
}
