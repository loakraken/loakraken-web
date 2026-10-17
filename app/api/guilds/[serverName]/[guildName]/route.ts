import { toResponse } from "@/lib/api/respond";
import { parseGuildDetailQuery } from "@/lib/stats/guild-detail";
import { getGuildDetail } from "@/lib/stats/server";
import { isGuildRankingEnabled } from "@/lib/tools/flags";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ serverName: string; guildName: string }> },
) {
  // The guild data is the guild ranking's: off there, off here.
  if (!isGuildRankingEnabled()) return toResponse({ ok: false, error: { code: "NOT_FOUND", status: 404 } });
  const { serverName, guildName } = await params;
  const query = parseGuildDetailQuery(
    decodeURIComponent(serverName),
    decodeURIComponent(guildName),
    new URL(request.url).searchParams,
  );
  if (!query) return toResponse({ ok: false, error: { code: "INVALID_REQUEST", status: 400 } });
  return toResponse(await getGuildDetail(query, request.signal));
}
