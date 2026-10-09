import type { BackendFailure, BackendResult } from "../api/backend";
import type { NewsEnvelope, ScheduleEnvelope } from "./model";

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

export const fetchNews = (signal: AbortSignal) =>
  call<NewsEnvelope>("/api/home/news?limit=15", signal);

/** Query key for a schedule day; null is "today" so the server prefetch hydrates. */
export const homeScheduleKey = (date: string | null) =>
  ["home-schedule", date ?? "today"] as const;
export const homeNewsKey = ["home-news"] as const;
