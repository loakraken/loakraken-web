import { getItemMinutes, toResponse } from "@/lib/market/server";
import { parseMinuteItemId } from "@/lib/market/minutes";

export async function GET(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const id = parseMinuteItemId((await params).itemId);
  if (id == null) return toResponse({ ok: false, error: { code: "INVALID_REQUEST", status: 400 } });
  return toResponse(await getItemMinutes(id, request.signal));
}
