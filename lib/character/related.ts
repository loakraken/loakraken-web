import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { characterNameError, normalizeCharacterName } from "./model";
import {
  isHistoryEnvelope,
  isSiblingsEnvelope,
  type HistoryEnvelope,
  type SiblingsEnvelope,
} from "./validate";

// Siblings (#54) and observation history (#66) for the character page tabs.
const siblingsErrors: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["CHARACTER_NOT_FOUND"],
  429: ["LOST_ARK_RATE_LIMITED"],
  502: ["LOST_ARK_API_ERROR"],
  503: ["LOST_ARK_NOT_CONFIGURED", "CHARACTER_CACHE_UNAVAILABLE"],
  504: ["LOST_ARK_API_TIMEOUT"],
};
const historyErrors: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  503: ["CHARACTER_HISTORY_DISABLED", "CHARACTER_HISTORY_UNAVAILABLE"],
};
const invalid = {
  ok: false as const,
  error: { code: "INVALID_REQUEST", status: 400 },
};
type Options = {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export function requestSiblings(
  name: string,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<SiblingsEnvelope>> {
  if (characterNameError(name)) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/siblings");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  return requestBackend(url, {
    ...options,
    isValid: isSiblingsEnvelope,
    errorCodes: siblingsErrors,
  });
}

export function requestHistory(
  name: string,
  server: string,
  origin: string | undefined,
  options: Options & { limit?: number } = {},
): Promise<BackendResult<HistoryEnvelope>> {
  const serverName = normalizeCharacterName(server);
  if (characterNameError(name) || characterNameError(serverName))
    return Promise.resolve(invalid);
  const limit = options.limit ?? 200;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500)
    return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/history");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  url?.searchParams.set("serverName", serverName);
  url?.searchParams.set("limit", String(limit));
  return requestBackend(url, {
    ...options,
    isValid: isHistoryEnvelope,
    errorCodes: historyErrors,
  });
}
