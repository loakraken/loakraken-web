import "server-only";
import { toResponse } from "@/lib/api/respond";
import { isSameSite } from "@/lib/api/same-site";
import { isPriceAlertsEnabled } from "@/lib/tools/flags";
import { isAlertId, isManageToken, TOKEN_HEADER } from "./model";

// Shared by the /api/alerts routes: the flag (off: as if the routes did not
// exist), the same-site check on every change, the ids and the token checked
// before anything reaches the backend.

export const origin = () => process.env.LOAKRAKEN_API_ORIGIN;

const fail = (code: string, status: number) => toResponse({ ok: false, error: { code, status } });
export const notFound = () => fail("NOT_FOUND", 404);
export const invalid = () => fail("INVALID_REQUEST", 400);

/** Off, or a change from another site: the answer to give instead, else null. */
export function guard(request: Request, change: boolean) {
  if (!isPriceAlertsEnabled()) return notFound();
  if (change && !isSameSite(request)) return fail("INVALID_REQUEST", 403);
  return null;
}

/** The subscription id and token of a request, or null when either is malformed. */
export function credentials(request: Request, subscriptionId: string) {
  const token = request.headers.get(TOKEN_HEADER)?.trim() ?? null;
  return isAlertId(subscriptionId) && isManageToken(token) ? { subscriptionId, token } : null;
}

export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
