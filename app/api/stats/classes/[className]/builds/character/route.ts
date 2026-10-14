import { toResponse } from "@/lib/api/respond";
import { parseClassBuildCellsQuery } from "@/lib/stats/class-builds";
import { getClassBuildCells } from "@/lib/stats/server";

export async function GET(request: Request, { params }: { params: Promise<{ className: string }> }) {
  const { className } = await params;
  const query = parseClassBuildCellsQuery(decodeURIComponent(className), new URL(request.url).searchParams);
  if (!query) return toResponse({ ok: false, error: { code: "INVALID_REQUEST", status: 400 } });
  return toResponse(await getClassBuildCells(query, request.signal));
}
