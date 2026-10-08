import { getMarketBoard, toResponse } from "@/lib/market/server";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  return toResponse(await getMarketBoard(query, request.signal));
}
