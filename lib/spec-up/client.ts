import type { BackendFailure, BackendResult } from "../api/backend";
import type { Sort, SpecUpEnvelope } from "./model";

export class SpecUpQueryError extends Error {
  info: BackendFailure;
  constructor(info: BackendFailure) {
    super(info.code);
    this.info = info;
  }
}

export async function fetchSpecUp(characterName: string, sort: Sort, signal?: AbortSignal) {
  const params = new URLSearchParams({ characterName, sort });
  try {
    const response = await fetch(`/api/characters/spec-up?${params}`, { cache: "no-store", signal });
    const result: BackendResult<SpecUpEnvelope> = await response.json();
    if (!result.ok) throw new SpecUpQueryError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof SpecUpQueryError || signal?.aborted) throw error;
    throw new SpecUpQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}
