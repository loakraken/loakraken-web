import { getItemHistory, toResponse } from "@/lib/market/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const range = new URL(request.url).searchParams.get("range");
  return toResponse(await getItemHistory(itemId, request.signal, undefined, range));
}
