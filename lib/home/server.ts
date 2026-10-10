import "server-only";
import { requestNews, requestPatchNotes, requestSchedule } from "./upstream";

type Options = { signal?: AbortSignal; timeoutMs?: number };

export function getSchedule(date: string | null, options: Options = {}) {
  return requestSchedule(date, process.env.LOAKRAKEN_API_ORIGIN, options);
}

export function getNews(limit: number, options: Options = {}) {
  return requestNews(limit, process.env.LOAKRAKEN_API_ORIGIN, options);
}

/** A category outside the patch kinds comes back INVALID_REQUEST (400). */
export function getPatchNotes(
  query: { category: string | null; page: number },
  options: Options = {},
) {
  return requestPatchNotes(query, process.env.LOAKRAKEN_API_ORIGIN, options);
}
