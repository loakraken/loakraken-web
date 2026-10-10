import type { BackendFailure, BackendResult } from "../api/backend";
import type { NewsEnvelope, PatchCategory, PatchNotesEnvelope, ScheduleEnvelope } from "./model";

export class HomeQueryError extends Error {
  info: BackendFailure;
  constructor(info: BackendFailure) {
    super(info.code);
    this.info = info;
  }
}

async function call<T>(path: string, signal: AbortSignal): Promise<T> {
  try {
    const response = await fetch(path, { signal, cache: "no-store" });
    const result: BackendResult<T> = await response.json();
    if (!result.ok) throw new HomeQueryError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof HomeQueryError || signal.aborted) throw error;
    throw new HomeQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}

export const fetchSchedule = (date: string | null, signal: AbortSignal) =>
  call<ScheduleEnvelope>(`/api/home/schedule${date ? `?date=${date}` : ""}`, signal);

export const fetchNews = (signal: AbortSignal, limit = 15) =>
  call<NewsEnvelope>(`/api/home/news?limit=${limit}`, signal);

export const fetchPatchNotes = (category: PatchCategory | null, page: number, signal: AbortSignal) =>
  call<PatchNotesEnvelope>(
    `/api/home/patch-notes?page=${page}${category ? `&category=${category}` : ""}`,
    signal,
  );

/** Query key for a schedule day; null is "today" so the server prefetch hydrates. */
export const homeScheduleKey = (date: string | null) =>
  ["home-schedule", date ?? "today"] as const;
export const homeNewsKey = ["home-news"] as const;
/** The /news page reads the most the backend serves (50) in one call. */
export const NEWS_PAGE_LIMIT = 50;
export const newsPageKey = ["news", NEWS_PAGE_LIMIT] as const;
export const patchNotesKey = (category: PatchCategory | null) =>
  ["patch-notes", category ?? "all"] as const;
