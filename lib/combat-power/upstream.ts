import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { parseSimulateRequest, type OptionsEnvelope, type SimulateEnvelope } from "./model";
import { isOptionsEnvelope, isSimulateEnvelope } from "./validate";

// Backend #240 docs/combat-power-simulator.md, error table.
const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["CHARACTER_NOT_CACHED"],
  409: ["CHANGE_TARGET_NOT_FOUND"],
  429: ["CLIENT_RATE_LIMITED"],
  503: ["CHARACTER_STORAGE_UNAVAILABLE"],
};

type Options = { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number };

export async function requestSimulation(
  body: unknown,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<SimulateEnvelope>> {
  const request = parseSimulateRequest(body);
  if (!request)
    return { ok: false, error: { code: "INVALID_REQUEST", status: 400 } };
  return requestBackend(backendUrl(origin, "/api/v1/characters/combat-power/simulate"), {
    ...options,
    method: "POST",
    body: request,
    isValid: isSimulateEnvelope,
    errorCodes,
  });
}

export const requestOptions = (
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<OptionsEnvelope>> =>
  requestBackend(backendUrl(origin, "/api/v1/characters/combat-power/options"), {
    ...options,
    isValid: isOptionsEnvelope,
    errorCodes,
  });
