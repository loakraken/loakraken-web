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
  { karma = false, armor = false, gem = false, ...options }: Options & { karma?: boolean; armor?: boolean; gem?: boolean } = {},
): Promise<BackendResult<SimulateEnvelope>> {
  // karma: KARMA_SIM on this deployment; off, a karmaLevel change is refused here (PM 총괄 #1815 P2).
  // armor: ARMOR_CP_SIM on this deployment; off, every 상급 재련 change is refused here (PM 총괄 11-21).
  // gem: ARK_GEM_SIM on this deployment; off, every ARK_GRID_GEM change is refused here (api #1079, web #1935).
  const request = parseSimulateRequest(body, { karma, armor, gem });
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
