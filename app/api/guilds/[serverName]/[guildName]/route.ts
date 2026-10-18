import { toResponse } from "@/lib/api/respond";
import { parseGuildDetailQuery } from "@/lib/stats/guild-detail";
import { getGuildDetail } from "@/lib/stats/server";
import { isGuildTabEnabled } from "@/lib/tools/flags";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ serverName: string; guildName: string }> },
) {
  // The character guild tab's data: its own switch (GUILD_TAB), apart from the ranking.
  if (!isGuildTabEnabled()) return toResponse({ ok: false, error: { code: "NOT_FOUND", status: 404 } });
  const { serverName, guildName } = await params;
  const query = parseGuildDetailQuery(
    decodeURIComponent(serverName),
    decodeURIComponent(guildName),
    new URL(request.url).searchParams,
  );
  if (!query) return toResponse({ ok: false, error: { code: "INVALID_REQUEST", status: 400 } });
  return toResponse(await getGuildDetail(query, request.signal));
}
