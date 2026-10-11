import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { characterNameError, normalizeCharacterName } from "../character/model";
import { isSort, type SpecUpEnvelope } from "./model";
import { isSpecUpEnvelope } from "./validate";

// Backend #318 SpecUpController error table.
const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["SPEC_UP_DISABLED", "CHARACTER_NOT_CACHED"],
  429: ["CLIENT_RATE_LIMITED"],
  503: ["CHARACTER_STORAGE_UNAVAILABLE"],
};

type Options = { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number };

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
