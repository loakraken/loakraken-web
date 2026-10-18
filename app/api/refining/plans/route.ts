import { planRefining, toResponse } from "@/lib/refining/server";
import { isSameSite } from "@/lib/api/same-site";

export async function POST(request: Request) {
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
  return toResponse(await planRefining(body, request.signal));
}
