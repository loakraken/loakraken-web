import { isSameSite } from "@/lib/api/same-site";
import { normalizeUserKey } from "@/lib/byok/key";
import { byokEnabled, clearUserKey, storeUserKey, userKeyStatus } from "@/lib/byok/server";

// The user's own official API key (BYOK, api #804; off unless BYOK_ENABLED).
// GET answers only whether a key is set and its last four characters; POST
// seals it into an HttpOnly cookie; DELETE forgets it. The key never comes
// back to the browser and is never logged (보안 R1, R2).
const NO_STORE = { "Cache-Control": "no-store" };
const fail = (code: string, status: number) =>
  Response.json({ ok: false, error: { code, status } }, { status, headers: NO_STORE });
const off = () => fail("NOT_FOUND", 404);

export async function GET() {
  if (!byokEnabled()) return off();
  return Response.json({ ok: true, data: await userKeyStatus() }, { headers: NO_STORE });
}

export async function POST(request: Request) {
  if (!byokEnabled()) return off();
  if (!isSameSite(request)) return fail("INVALID_REQUEST", 403);
  let body: unknown;
  try {
    // A key is short: a large body is not one.
    const text = await request.text();
    if (text.length > 4096) return fail("USER_KEY_MALFORMED", 400);
    body = JSON.parse(text);
  } catch {
    return fail("INVALID_REQUEST", 400);
  }
  const { key, remember } = (body ?? {}) as { key?: unknown; remember?: unknown };
  const normalized = normalizeUserKey(key);
  if (!normalized) return fail("USER_KEY_MALFORMED", 400);
  const status = await storeUserKey(normalized, remember === true);
  return status ? Response.json({ ok: true, data: status }, { headers: NO_STORE }) : off();
}

export async function DELETE(request: Request) {
  if (!byokEnabled()) return off();
  if (!isSameSite(request)) return fail("INVALID_REQUEST", 403);
  await clearUserKey();
  return Response.json({ ok: true, data: { set: false, hint: null, expiresAt: null } }, { headers: NO_STORE });
}
