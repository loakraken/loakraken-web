import { parseGemPick } from "@/lib/market/auction-gems";
import { parseCellRange } from "@/lib/market/cell-history";
import { getGemHistory, toResponse } from "@/lib/market/server";

/** One gem cell's lowest price by day (api #920); only the cell and a known range go on. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const pick = parseGemPick(params);
  const range = parseCellRange(params.get("range"));
  if (!pick || !range) return toResponse({ ok: false, error: { code: "INVALID_REQUEST", status: 400 } });
  return toResponse(await getGemHistory(pick, range, request.signal));
}
