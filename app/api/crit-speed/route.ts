import { calculateCritSpeed, toResponse } from "@/lib/crit-speed/server";
import { isSameSite } from "@/lib/api/same-site";
import { isCritSpeedEnabled } from "@/lib/tools/flags";

export async function POST(request: Request) {
  if (!isCritSpeedEnabled())
    return toResponse({ ok: false, error: { code: "NOT_FOUND", status: 404 } });
  // Only this site's own pages: a form or script on another site must not spend the visitor's limit.
  if (!isSameSite(request))
    return toResponse({ ok: false, error: { code: "INVALID_REQUEST", status: 403 } });
  if (!request.headers.get("content-type")?.includes("application/json"))
    return toResponse({
      ok: false,
      error: { code: "UNSUPPORTED_MEDIA_TYPE", status: 415 },
    });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toResponse({
      ok: false,
      error: { code: "INVALID_REQUEST", status: 400 },
    });
  }
  return toResponse(await calculateCritSpeed(body, request.signal));
}
