import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { characterNameError, normalizeCharacterName } from "../character/model";
import { isSort, type SpecUpEnvelope } from "./model";
import { isGoalEnvelope, isSpecUpEnvelope } from "./validate";
import type { GoalEnvelope } from "./goal";

// Backend #318 SpecUpController error table.
const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["SPEC_UP_DISABLED", "CHARACTER_NOT_CACHED"],
  429: ["CLIENT_RATE_LIMITED"],
  503: ["CHARACTER_STORAGE_UNAVAILABLE"],
};

type Options = { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number };

// api #455 SpecUpController goal error table. 429 is listed for its status and
// Retry-After only, so it reads as the shared rate-limit notice.
const goalErrorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "SPEC_UP_GOAL_OUT_OF_RANGE"],
  404: ["SPEC_UP_DISABLED", "CHARACTER_NOT_CACHED"],
  429: [],
  503: ["CHARACTER_STORAGE_UNAVAILABLE"],
};

export async function requestSpecUpGoal(
  characterName: string,
  target: string | null,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<GoalEnvelope>> {
  // Same rule as the backend: above 0, at most two decimals (the 2× cap is the backend's).
  if (characterNameError(characterName) || !target || !/^\d{1,9}(\.\d{1,2})?$/.test(target) || Number(target) <= 0)
    return { ok: false, error: { code: "INVALID_REQUEST", status: 400 } };
  const url = backendUrl(origin, "/api/v1/characters/spec-up/goal");
  if (url) {
    url.searchParams.set("characterName", normalizeCharacterName(characterName));
    url.searchParams.set("targetCombatPower", target);
  }
  // The path search has its own time cap on the backend.
  return requestBackend(url, { timeoutMs: 30_000, ...options, isValid: isGoalEnvelope, errorCodes: goalErrorCodes });
}

export async function requestSpecUp(
  characterName: string,
  sort: string | null,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<SpecUpEnvelope>> {
  if (characterNameError(characterName))
    return { ok: false, error: { code: "INVALID_REQUEST", status: 400 } };
  const url = backendUrl(origin, "/api/v1/characters/spec-up");
  if (url) {
    url.searchParams.set("characterName", normalizeCharacterName(characterName));
    if (isSort(sort)) url.searchParams.set("sort", sort);
    url.searchParams.set("limit", "50");
  }
  return requestBackend(url, { ...options, isValid: isSpecUpEnvelope, errorCodes });
}
