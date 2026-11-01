import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { parsePlanRequest, type PlanEnvelope } from "./model";
import { isPlanEnvelope } from "./validate";

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "REFINING_SUCCESS_RATE_MISMATCH"],
  415: ["UNSUPPORTED_MEDIA_TYPE"],
};

export async function requestPlan(
  body: unknown,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<PlanEnvelope>> {
  const request = parsePlanRequest(body);
  if (!request)
    return { ok: false, error: { code: "INVALID_REQUEST", status: 400 } };
  return requestBackend(backendUrl(origin, "/api/v1/refining/plans"), {
    ...options,
    method: "POST",
    body: request,
    isValid: isPlanEnvelope,
    errorCodes,
  });
}
