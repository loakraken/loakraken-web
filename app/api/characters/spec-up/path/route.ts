import { getSpecUpPath, toResponse } from "@/lib/spec-up/server";
import { isSpecUpPathEnabled } from "@/lib/tools/flags";

export async function GET(request: Request) {
  if (!isSpecUpPathEnabled())
    return toResponse({ ok: false, error: { code: "SPEC_UP_DISABLED", status: 404 } });
  const params = new URL(request.url).searchParams;
  return toResponse(await getSpecUpPath(params.get("characterName") ?? "", params.get("sort"), request.signal));
}
