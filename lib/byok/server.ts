import "server-only";
import { readFileSync } from "node:fs";
import { cookies } from "next/headers";
import { REMEMBER_DAYS, keyHint, type UserKeyStatus } from "./key";
import { sealSecret, sealUserKey, unsealUserKey } from "./seal";

// BYOK on the web server (보안 R1–R10, api #804). Off unless BYOK_ENABLED=true
// AND a seal secret is configured: the page, the route and the header all
// follow byokEnabled(). The api ignores the header unless its own flag is on
// and the peer is this server.

/** Cookie the browser cannot read: __Host- (Secure, Path=/, no Domain), HttpOnly, Strict. */
export const COOKIE = "__Host-lk_key";
/** Sent to the api for character search and siblings only. */
export const USER_KEY_HEADER = "X-LK-User-Key";

/**
 * The seal secret: a file secret in production (BYOK_SEAL_KEY_FILE, base64 of
 * 32 bytes), or BYOK_SEAL_KEY outside production (tests). Rotating it logs every
 * user out of BYOK (their cookies no longer open).
 */
function secret(): Buffer | null {
  const file = process.env.BYOK_SEAL_KEY_FILE;
  if (file) {
    try {
      return sealSecret(readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  }
  return process.env.NODE_ENV !== "production" ? sealSecret(process.env.BYOK_SEAL_KEY) : null;
}

export const byokEnabled = () => process.env.BYOK_ENABLED === "true" && secret() !== null;

/** Set-Cookie options: a session cookie, or up to REMEMBER_DAYS when asked. */
export function cookieOptions(remember: boolean) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "strict" as const,
    path: "/",
    ...(remember && { maxAge: REMEMBER_DAYS * 24 * 60 * 60 }),
  };
}

/** Seals the key and sets the cookie; returns what the page may know. */
export async function storeUserKey(key: string, remember: boolean): Promise<UserKeyStatus | null> {
  const s = secret();
  if (!s) return null;
  // A session cookie still carries an expiry inside the seal (a day), so a
  // copied cookie stops working on its own.
  const expiresAt = new Date(Date.now() + (remember ? REMEMBER_DAYS : 1) * 24 * 60 * 60 * 1000);
  (await cookies()).set(COOKIE, sealUserKey(key, expiresAt, s), cookieOptions(remember));
  return { set: true, hint: keyHint(key), expiresAt: expiresAt.toISOString() };
}

export async function clearUserKey() {
  (await cookies()).set(COOKIE, "", { ...cookieOptions(false), maxAge: 0 });
}

/** The user's key for this request, or null (off, none, altered, expired). Never logged. */
export async function currentUserKey(): Promise<string | null> {
  if (!byokEnabled()) return null;
  const s = secret();
  const sealed = (await cookies()).get(COOKIE)?.value;
  return s ? (unsealUserKey(sealed, s)?.key ?? null) : null;
}

export async function userKeyStatus(): Promise<UserKeyStatus> {
  const s = secret();
  const opened = s ? unsealUserKey((await cookies()).get(COOKIE)?.value, s) : null;
  return opened
    ? { set: true, hint: keyHint(opened.key), expiresAt: opened.expiresAt.toISOString() }
    : { set: false, hint: null, expiresAt: null };
}

/** The header for an api call that may spend the user's own quota, or none. */
export async function userKeyHeaders(): Promise<Record<string, string>> {
  const key = await currentUserKey();
  return key ? { [USER_KEY_HEADER]: key } : {};
}
