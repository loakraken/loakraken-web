import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { parsePlanRequest, type PlanEnvelope } from "./model";
import { isAdvancedEnvelope, isPlanEnvelope } from "./validate";
import { parseAdvancedRequest, type AdvancedEnvelope } from "./advanced";

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "REFINING_SUCCESS_RATE_MISMATCH", "REFINING_ARTISAN_ENERGY_MISMATCH"],
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

// advanced-plans (api #1091 contract §4): 전율 400 REFINING_ADVANCED_UNCONFIRMED, a missing base price 409.
const advancedErrorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "REFINING_ADVANCED_UNCONFIRMED"],
  409: ["REFINING_PRICE_PENDING"],
  415: ["UNSUPPORTED_MEDIA_TYPE"],
};

export async function requestAdvancedPlan(
  body: unknown,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<AdvancedEnvelope>> {
  const request = parseAdvancedRequest(body);
  if (!request)
    return { ok: false, error: { code: "INVALID_REQUEST", status: 400 } };
  return requestBackend(backendUrl(origin, "/api/v1/refining/advanced-plans"), {
    ...options,
    method: "POST",
    body: request,
    isValid: isAdvancedEnvelope,
    errorCodes: advancedErrorCodes,
  });
}
