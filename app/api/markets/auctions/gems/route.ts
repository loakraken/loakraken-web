import { getGemBoard, toResponse } from "@/lib/market/server";

export async function GET(request: Request) {
  return toResponse(await getGemBoard(request.signal));
}
