// A user's own official Open API key (BYOK, api #804; behind BYOK_ENABLED, off).
// Client-safe pieces only: the shape check, the hint and the names. The key
// itself lives in a sealed HttpOnly cookie that the browser cannot read
// (lib/byok/server.ts); the page only ever sees the hint.

/** The official key is JWT-shaped: three base64url parts (the api checks the same). */
const SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
/** The api's own upper bound. */
export const MAX_KEY_LENGTH = 2048;

/** Trimmed key when it has the official shape, else null. */
export function normalizeUserKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim();
  return key.length > 0 && key.length <= MAX_KEY_LENGTH && SHAPE.test(key) ? key : null;
}

/** What the page may show of a key: its last four characters. */
export const keyHint = (key: string) => `…${key.slice(-4)}`;

/** Remembered for at most this long when the user asks; otherwise for the browser session. */
export const REMEMBER_DAYS = 7;

/** Codes the api answers for a user key (#804). */
export const USER_KEY_CODES = ["USER_KEY_MALFORMED", "USER_KEY_INVALID", "USER_KEY_RATE_LIMITED"] as const;
export type UserKeyCode = (typeof USER_KEY_CODES)[number];
export const isUserKeyCode = (code: string | undefined): code is UserKeyCode =>
  !!code && (USER_KEY_CODES as readonly string[]).includes(code);

/** What GET /api/byok answers (never the key). */
export type UserKeyStatus = { set: boolean; hint: string | null; expiresAt: string | null };
