import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { characterNameError, normalizeCharacterName } from "../character/model";
import { isSort, type SpecUpEnvelope } from "./model";
import { isDetailEnvelope, isGoalEnvelope, isSpecUpEnvelope } from "./validate";
import type { GoalEnvelope } from "./goal";
import type { DetailEnvelope } from "./detail";

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

// 줄 상세 (백엔드 2): same switch and cache as the guide; an id that is no
// longer a candidate (the list changed) is a 404 of its own.
const detailErrorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["SPEC_UP_DISABLED", "CHARACTER_NOT_CACHED", "SPEC_UP_CANDIDATE_NOT_FOUND"],
  429: ["CLIENT_RATE_LIMITED"],
  503: ["CHARACTER_STORAGE_UNAVAILABLE"],
};

/**
 * Candidate ids: a kind and up to four parts — GEM_LEVEL:3:8, and engraving
 * lines carry the name with its spaces, ENGRAVING_LEVEL:기습의 대가:4 (api #573).
 * The id is sent percent-encoded (a space as %20, never "+").
 */
const CANDIDATE_ID = /^[A-Z_]{2,40}(:[^:/?#\\\u0000-\u001f]{1,40}){0,4}$/u;

export async function requestSpecUpDetail(
  characterName: string,
  candidateId: string,
  origin: string | undefined,
  options: Options = {},
  includeCooldownGems: string | null = null,
): Promise<BackendResult<DetailEnvelope>> {
  if (characterNameError(characterName) || !CANDIDATE_ID.test(candidateId))
    return { ok: false, error: { code: "INVALID_REQUEST", status: 400 } };
  const url = backendUrl(origin, `/api/v1/characters/spec-up/candidates/${encodeURIComponent(candidateId)}`);
  if (url) {
    url.searchParams.set("characterName", normalizeCharacterName(characterName));
    // api #588: only "true"/"false" pass; without it the backend looks among all candidates.
    if (includeCooldownGems === "true" || includeCooldownGems === "false")
      url.searchParams.set("includeCooldownGems", includeCooldownGems);
  }
  return requestBackend(url, { ...options, isValid: isDetailEnvelope, errorCodes: detailErrorCodes });
}

export async function requestSpecUp(
  characterName: string,
  sort: string | null,
  origin: string | undefined,
  options: Options = {},
  includeCooldownGems: string | null = null,
): Promise<BackendResult<SpecUpEnvelope>> {
  if (characterNameError(characterName))
    return { ok: false, error: { code: "INVALID_REQUEST", status: 400 } };
  const url = backendUrl(origin, "/api/v1/characters/spec-up");
  if (url) {
    url.searchParams.set("characterName", normalizeCharacterName(characterName));
    if (isSort(sort)) url.searchParams.set("sort", sort);
    // api #573: only "true"/"false" pass; anything else is left to the backend's default.
    if (includeCooldownGems === "true" || includeCooldownGems === "false")
      url.searchParams.set("includeCooldownGems", includeCooldownGems);
    url.searchParams.set("limit", "50");
  }
  return requestBackend(url, { ...options, isValid: isSpecUpEnvelope, errorCodes });
}
