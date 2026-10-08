import "server-only";
import { requestNews, requestSchedule } from "./upstream";

type Options = { signal?: AbortSignal; timeoutMs?: number };

export function getSchedule(date: string | null, options: Options = {}) {
  return requestSchedule(date, process.env.LOAKRAKEN_API_ORIGIN, options);
}

export function getNews(limit: number, options: Options = {}) {
  return requestNews(limit, process.env.LOAKRAKEN_API_ORIGIN, options);
}
