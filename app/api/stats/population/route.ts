import { toResponse } from "@/lib/api/respond";
import { getPopulation } from "@/lib/stats/server";
import { isPopulationStatsEnabled } from "@/lib/tools/flags";

export async function GET(request: Request) {
  // Off with the tab (POPULATION_STATS): no backend call for a hidden screen.
  if (!isPopulationStatsEnabled()) return toResponse({ ok: false, error: { code: "NOT_FOUND", status: 404 } });
  const server = new URL(request.url).searchParams.get("server") ?? undefined;
  return toResponse(await getPopulation(server, request.signal));
}
