import { failureOf } from "@/lib/api/rate-limit";

/** How often an open price board refreshes (the exchange board's rule). */
export const BOARD_REFRESH_MS = 60_000;

/**
 * refetchInterval for the gem and accessory boards: prices are kept current
 * (user 10-16) — every minute while the page is visible (react-query never
 * polls a background tab), every 5 s for at most six looks (30 s) while blank
 * cells are still being read, and never before a rate limit's retryAt.
 */
export function boardRefresh(query: {
  state: { data?: { data: { complete: boolean } }; error: unknown; dataUpdateCount: number };
}) {
  const retryAt = failureOf(query.state.error)?.retryAt;
  if (retryAt) return Math.max(BOARD_REFRESH_MS, retryAt - Date.now());
  const data = query.state.data;
  if (data && !data.data.complete && query.state.dataUpdateCount < 7) return 5_000;
  return BOARD_REFRESH_MS;
}
