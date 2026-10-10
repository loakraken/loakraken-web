import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { isDate, type NewsEnvelope, type ScheduleEnvelope } from "./model";
import { isNewsEnvelope, isScheduleEnvelope } from "./validate";

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  429: ["LOST_ARK_RATE_LIMITED"],
  502: ["LOST_ARK_API_ERROR"],
  503: ["LOST_ARK_NOT_CONFIGURED", "HOME_CACHE_UNAVAILABLE"],
  504: ["LOST_ARK_API_TIMEOUT"],
};
const invalid = {
  ok: false as const,
  error: { code: "INVALID_REQUEST", status: 400 },
};
type Options = { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number };

/** Schedule for a KST date (omitted: today). */
export function requestSchedule(
  date: string | null,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<ScheduleEnvelope>> {
  if (date !== null && !isDate(date)) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/home/schedule");
  if (date) url?.searchParams.set("date", date);
  return requestBackend(url, { ...options, isValid: isScheduleEnvelope, errorCodes });
}

/** Latest notices and running events. */
export function requestNews(
  limit: number,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<NewsEnvelope>> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/home/news");
  url?.searchParams.set("limit", String(limit));
  return requestBackend(url, { ...options, isValid: isNewsEnvelope, errorCodes });
}
