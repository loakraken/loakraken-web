import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { isEngravingIconsEnvelope, type EngravingIconsEnvelope } from "./engraving-icons";

const errorCodes = { 429: ["RATE_LIMITED"], 502: ["LOST_ARK_API_ERROR"], 503: ["SERVICE_UNAVAILABLE"] } as const;

/** Engraving icons from the backend (#780). */
export function requestEngravingIcons(
  origin: string | undefined,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<EngravingIconsEnvelope>> {
  return requestBackend(backendUrl(origin, "/api/v1/markets/engraving-icons"), {
    ...options,
    isValid: isEngravingIconsEnvelope,
    errorCodes,
  });
}
