import type { BackendFailure, BackendResult } from "../api/backend";
import type { PlanEnvelope, PlanRequest } from "./model";

export class RefiningQueryError extends Error {
  info: BackendFailure;
  constructor(info: BackendFailure) {
    super(info.code);
    this.info = info;
  }
}

export async function postRefiningPlan(
  body: PlanRequest,
  signal?: AbortSignal,
): Promise<PlanEnvelope> {
  try {
    const response = await fetch("/api/refining/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    });
    const result: BackendResult<PlanEnvelope> = await response.json();
    if (!result.ok) throw new RefiningQueryError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof RefiningQueryError || signal?.aborted) throw error;
    throw new RefiningQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}
