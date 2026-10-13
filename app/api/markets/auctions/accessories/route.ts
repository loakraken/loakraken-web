import { parseAccessoryFilter } from "@/lib/market/auction-accessories";
import { getAccessoryBoard, toResponse } from "@/lib/market/server";

export async function GET(request: Request) {
  return toResponse(await getAccessoryBoard(parseAccessoryFilter(new URL(request.url).searchParams), request.signal));
}
