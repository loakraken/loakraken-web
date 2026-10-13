// Time left, one format for the whole site (user, 19:32): schedule rounds,
// the weekly reset, refresh cooldowns, rate-limit waits and homework.

export const SECOND = 1000;
export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

/**
 * "2일 3시간" · "3시간 5분" · "25분 03초" · "45초" — never "0시간 …". Under an
 * hour the seconds are two digits so the text keeps its width as it ticks.
 * null once the time has passed (or is not a number).
 */
export function remainingText(ms: number): string | null {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const total = Math.floor(ms / SECOND);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${String(seconds).padStart(2, "0")}초`;
  return `${seconds}초`;
}

/**
 * The clock step the text needs: seconds only under an hour (a minute
 * clock is one tick late at most when it switches, so allow one minute more).
 */
export const remainingStep = (ms: number) => (ms < HOUR + MINUTE ? SECOND : MINUTE);

/**
 * "Now" for time-dependent rows: the minute clock, but not the part of a
 * minute it floors away. The minute clock reads 23:00:07 as 23:00:00, so right
 * after the hour a round the server already hid as past (23:00) came back on
 * the first client tick and pushed the list down (A6 on /schedule, CI run at
 * 23:00:08, web #674). Within that minute the server render time is the later,
 * truer now; a clock further behind is the browser's own date and wins.
 */
export function clampNow(clock: number | null, renderedAt: number | null | undefined): number | null {
  if (clock === null) return renderedAt ?? null;
  return renderedAt != null && renderedAt > clock && renderedAt - clock < MINUTE ? renderedAt : clock;
}
