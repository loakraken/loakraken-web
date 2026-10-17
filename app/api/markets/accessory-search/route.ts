import { searchAccessories, toResponse } from "@/lib/accessory-search/server";
import { isAccessorySearchEnabled } from "@/lib/tools/flags";

export async function POST(request: Request) {
  if (!isAccessorySearchEnabled())
    return toResponse({ ok: false, error: { code: "NOT_FOUND", status: 404 } });
  if (!request.headers.get("content-type")?.includes("application/json"))
    return toResponse({ ok: false, error: { code: "UNSUPPORTED_MEDIA_TYPE", status: 415 } });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toResponse({ ok: false, error: { code: "INVALID_REQUEST", status: 400 } });
  }
  return toResponse(await searchAccessories(body, request.signal));
}
