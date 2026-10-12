import type { BackendFailure, BackendResult } from "../api/backend";
import type { SearchEnvelope, SearchRequest } from "./model";

export class AccessorySearchError extends Error {
  info: BackendFailure;
  constructor(info: BackendFailure) {
    super(info.code);
    this.info = info;
  }
}

export async function postAccessorySearch(body: SearchRequest, signal?: AbortSignal) {
  try {
    const response = await fetch("/api/markets/accessory-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    });
    const result: BackendResult<SearchEnvelope> = await response.json();
    if (!result.ok) throw new AccessorySearchError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof AccessorySearchError || signal?.aborted) throw error;
    throw new AccessorySearchError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}
