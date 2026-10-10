import type { BackendFailure, BackendResult } from "../api/backend";
import type { CritSpeedEnvelope, CritSpeedRequest } from "./model";

export class CritSpeedQueryError extends Error {
  info: BackendFailure;
  constructor(info: BackendFailure) {
    super(info.code);
    this.info = info;
  }
}

export async function postCritSpeed(
  body: CritSpeedRequest,
  signal?: AbortSignal,
): Promise<CritSpeedEnvelope> {
  try {
    const response = await fetch("/api/crit-speed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    });
    const result: BackendResult<CritSpeedEnvelope> = await response.json();
    if (!result.ok) throw new CritSpeedQueryError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof CritSpeedQueryError || signal?.aborted) throw error;
    throw new CritSpeedQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}
