import "server-only";
import { requestNews, requestSchedule } from "./upstream";

export function getSchedule(date: string | null, signal?: AbortSignal) {
  return requestSchedule(date, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}

export function getNews(limit: number, signal?: AbortSignal) {
  return requestNews(limit, process.env.LOAKRAKEN_API_ORIGIN, { signal });
}
