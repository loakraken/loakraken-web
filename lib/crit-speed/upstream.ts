import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { parseCritSpeedRequest, type CritSpeedEnvelope } from "./model";
import { isCritSpeedEnvelope } from "./validate";

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["CHARACTER_NOT_FOUND"],
  415: ["UNSUPPORTED_MEDIA_TYPE"],
  429: ["LOST_ARK_RATE_LIMITED"],
  502: ["LOST_ARK_API_ERROR"],
  503: ["LOST_ARK_NOT_CONFIGURED", "CHARACTER_CACHE_UNAVAILABLE"],
  504: ["LOST_ARK_API_TIMEOUT"],
};

export async function requestCritSpeed(
  body: unknown,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<CritSpeedEnvelope>> {
  const request = parseCritSpeedRequest(body);
  if (!request)
    return { ok: false, error: { code: "INVALID_REQUEST", status: 400 } };
  return requestBackend(backendUrl(origin, "/api/v1/characters/crit-speed"), {
    ...options,
    method: "POST",
    body: request,
    isValid: isCritSpeedEnvelope,
    errorCodes,
  });
}
