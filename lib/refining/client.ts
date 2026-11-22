import type { BackendFailure, BackendResult } from "../api/backend";
import type { PlanEnvelope, PlanRequest } from "./model";
import type { AdvancedEnvelope, AdvancedRequest } from "./advanced";

export class RefiningQueryError extends Error {
  info: BackendFailure;
  constructor(info: BackendFailure) {
    super(info.code);
    this.info = info;
  }
}

export const postRefiningPlan = (body: PlanRequest, signal?: AbortSignal) =>
  post<PlanEnvelope>("/api/refining/plans", body, signal);

/** 상급 재련 (web #1951). */
export const postAdvancedPlan = (body: AdvancedRequest, signal?: AbortSignal) =>
  post<AdvancedEnvelope>("/api/refining/advanced-plans", body, signal);

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    });
    const result: BackendResult<T> = await response.json();
    if (!result.ok) throw new RefiningQueryError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof RefiningQueryError || signal?.aborted) throw error;
    throw new RefiningQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}
