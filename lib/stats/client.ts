import type { BackendFailure, BackendResult } from "../api/backend";
import { statsSearch, type StatsEnvelopes, type StatsQuery, type StatsView } from "./model";

export class StatsQueryError extends Error {
  info: BackendFailure;
  constructor(info: BackendFailure) {
    super(info.code);
    this.info = info;
  }
}

export async function fetchStats<V extends StatsView>(
  view: V,
  query: StatsQuery,
  signal: AbortSignal,
): Promise<StatsEnvelopes[V]> {
  try {
    const response = await fetch(`/api/stats/${view}?${statsSearch(query)}`, { signal, cache: "no-store" });
    const result: BackendResult<StatsEnvelopes[V]> = await response.json();
    if (!result.ok) throw new StatsQueryError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof StatsQueryError || signal.aborted) throw error;
    throw new StatsQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}
