import { getMarketOptions, toResponse } from "@/lib/market/server";

export async function GET(request: Request) {
  return toResponse(await getMarketOptions(request.signal));
}
