import { getItemHistory, toResponse } from "@/lib/market/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  return toResponse(await getItemHistory(itemId, request.signal));
}
