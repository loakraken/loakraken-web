// Client hook for the shared 429 notice (lib/api/rate-limit.ts).
import { useEffect, useState } from "react";
import { RATE_LIMITED, failureOf, secondsUntil } from "./rate-limit";

/**
 * For a query error: whether it is a 429 and the seconds left, ticking every
 * second while positive.
 */
export function useRateLimit(error: unknown) {
  const failure = failureOf(error);
  const limited = failure?.code === RATE_LIMITED;
  const retryAt = limited ? failure.retryAt : undefined;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!retryAt) return;
    // Re-read the clock right away (a new error) and then each second until due.
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) clearInterval(timer);
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [retryAt]);
  return { limited, seconds: secondsUntil(retryAt, now) };
}
