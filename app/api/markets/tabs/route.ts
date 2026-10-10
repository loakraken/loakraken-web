import { getMarketTabs, toResponse } from "@/lib/market/server";

export async function GET(request: Request) {
  return toResponse(await getMarketTabs(request.signal));
}
