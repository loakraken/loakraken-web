import { BOT_AGENT } from "@/lib/api/backend";
import { toResponse } from "@/lib/api/respond";
import { getReceipt } from "@/lib/character/server";

export async function GET(request: Request) {
  // A crawler never starts a roster calculation (up to 8 official calls per
  // request, PM-백엔드 20:43): it gets the same answer as "receipt off".
  if (BOT_AGENT.test(request.headers.get("user-agent") ?? ""))
    return toResponse({ ok: false, error: { code: "RECEIPT_OFF", status: 404 } });
  const params = new URL(request.url).searchParams;
  return toResponse(
    await getReceipt(params.get("characterName") ?? "", params.get("assumeBook") === "true", request.signal),
  );
}
