// 429 from the backend (official-call limit or the per-client limit,
// CLIENT_RATE_LIMITED): every proxy route reports it as LOST_ARK_RATE_LIMITED
// with a retry time, and every screen shows the same notice with the seconds
// left. The retry button stays disabled until then; nothing retries by itself.
import { remainingText } from "../time/remaining";

export const RATE_LIMITED = "LOST_ARK_RATE_LIMITED";

type Failure = { code: string; retryAt?: number };

/** The `{ code, retryAt }` a client query error carries, if any. */
export function failureOf(error: unknown): Failure | null {
  if (!error || typeof error !== "object" || !("info" in error)) return null;
  const info = (error as { info: unknown }).info;
  return info && typeof info === "object" && "code" in info && typeof info.code === "string"
    ? (info as Failure)
    : null;
}

export const secondsUntil = (retryAt: number | undefined, now = Date.now()) =>
  retryAt ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : 0;

/**
 * The alert sentence: fixed, so a live region reads it once. The seconds
 * left go next to it (RateLimitNote) or on the retry button.
 */
export function rateLimitCopy() {
  return { title: "요청이 많아 잠시 쉬어 가요", text: "잠시 뒤 다시 시도해 주세요." };
}

/** Time left (shared format), for text outside live regions. */
export const countdownText = (seconds: number) =>
  seconds > 0 ? `${remainingText(seconds * 1000)} 뒤 다시 시도해 주세요.` : "이제 다시 시도할 수 있어요.";

export const retryLabel = (seconds: number, label = "다시 시도") =>
  seconds > 0 ? `${remainingText(seconds * 1000)} 뒤 ${label}` : label;

/**
 * refetchInterval for screens that read cached market prices: every
 * `everyMs` while the page is visible (react-query never refetches in a
 * background tab by default); after a 429 the next try waits for its retry
 * time (사용자 10-16: every screen with market prices refreshes each minute).
 */
export const refreshEvery =
  (everyMs: number) =>
  (query: { state: { error: unknown } }): number => {
    const retryAt = failureOf(query.state.error)?.retryAt;
    return retryAt ? Math.max(everyMs, retryAt - Date.now()) : everyMs;
  };
