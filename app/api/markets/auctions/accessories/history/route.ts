import { parseAccessoryFilter, parseAccessoryPick } from "@/lib/market/auction-accessories";
import { parseCellRange } from "@/lib/market/cell-history";
import { getAccessoryHistory, toResponse } from "@/lib/market/server";

/** One accessory cell's lowest price by day (api #920): the board's filter and cell, a known range. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const pick = parseAccessoryPick(params);
  const range = parseCellRange(params.get("range"));
  if (!pick || !range) return toResponse({ ok: false, error: { code: "INVALID_REQUEST", status: 400 } });
  return toResponse(await getAccessoryHistory(parseAccessoryFilter(params), pick, range, request.signal));
}
