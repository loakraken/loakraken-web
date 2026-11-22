import { rankGemProcessing, toResponse } from "@/lib/combat-power/server";
import { isSameSite } from "@/lib/api/same-site";
import { isGemRankingEnabled } from "@/lib/tools/flags";

// 젬 가공 순위 (web #1969, api gem-ranking #1095): there only while GEM_RANKING is on, paired with the api's switch.
export async function POST(request: Request) {
  if (!isGemRankingEnabled()) return toResponse({ ok: false, error: { code: "NOT_FOUND", status: 404 } });
  // Only this site's own pages: a form or script on another site must not spend the visitor's limit.
  if (!isSameSite(request)) return toResponse({ ok: false, error: { code: "INVALID_REQUEST", status: 403 } });
  if (!request.headers.get("content-type")?.includes("application/json"))
    return toResponse({ ok: false, error: { code: "UNSUPPORTED_MEDIA_TYPE", status: 415 } });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toResponse({ ok: false, error: { code: "INVALID_REQUEST", status: 400 } });
  }
  return toResponse(await rankGemProcessing(body, request.signal));
}
