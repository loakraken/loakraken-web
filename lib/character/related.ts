import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { characterNameError, normalizeCharacterName } from "./model";
import {
  isHistoryEnvelope,
  isSiblingsEnvelope,
  isViewsEnvelope,
  type HistoryEnvelope,
  type SiblingsEnvelope,
  type ViewsEnvelope,
} from "./validate";
import { type CardCollectionEnvelope, type CardRefreshEnvelope } from "./card-collection";
import { isCardCollectionEnvelope, isCardRefreshEnvelope } from "./card-collection.backend";
import {
  isRosterPowerEnvelope,
  isRosterPowerRefreshEnvelope,
  type RosterPowerEnvelope,
  type RosterPowerRefreshEnvelope,
} from "./roster-power";

// Siblings (#54) and observation history (#66) for the character page tabs.
// USER_KEY_*: the user's own API key (BYOK, api #804), as for the character search.
const siblingsErrors: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "USER_KEY_MALFORMED"],
  401: ["USER_KEY_INVALID"],
  404: ["CHARACTER_NOT_FOUND"],
  429: ["LOST_ARK_RATE_LIMITED", "USER_KEY_RATE_LIMITED"],
  502: ["LOST_ARK_API_ERROR"],
  503: ["LOST_ARK_NOT_CONFIGURED", "CHARACTER_CACHE_UNAVAILABLE", "LOST_ARK_GATE_UNAVAILABLE"],
  504: ["LOST_ARK_API_TIMEOUT"],
};
const historyErrors: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  503: ["CHARACTER_HISTORY_DISABLED", "CHARACTER_HISTORY_UNAVAILABLE"],
};
const viewsErrors: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  503: ["CHARACTER_VIEWS_DISABLED", "CHARACTER_VIEWS_UNAVAILABLE"],
};
const cardCollectionErrors: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["CHARACTER_NOT_FOUND"],
  429: ["LOST_ARK_RATE_LIMITED"],
  502: ["LOST_ARK_API_ERROR"],
  503: [
    "CARD_COLLECTION_DISABLED",
    "CARD_COLLECTION_UNAVAILABLE",
    "LOST_ARK_NOT_CONFIGURED",
    "CHARACTER_CACHE_UNAVAILABLE",
  ],
  504: ["LOST_ARK_API_TIMEOUT"],
};
const invalid = {
  ok: false as const,
  error: { code: "INVALID_REQUEST", status: 400 },
};
type Options = {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** The user's own key header for siblings (lib/byok/server.ts); never the browser's. */
  headers?: Record<string, string>;
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

/** LOAKraken search counts per KST day (F-8); `days` defaults to 16 weeks. */
export function requestViews(
  name: string,
  origin: string | undefined,
  options: Options & { days?: number } = {},
): Promise<BackendResult<ViewsEnvelope>> {
  if (characterNameError(name)) return Promise.resolve(invalid);
  const days = options.days ?? 112;
  if (!Number.isInteger(days) || days < 1 || days > 366)
    return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/views");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  url?.searchParams.set("days", String(days));
  return requestBackend(url, {
    ...options,
    isValid: isViewsEnvelope,
    errorCodes: viewsErrors,
  });
}

/** Same-server roster card records (F-6). */
export function requestCardCollection(
  name: string,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<CardCollectionEnvelope>> {
  if (characterNameError(name)) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/card-collection");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  return requestBackend(url, {
    ...options,
    isValid: isCardCollectionEnvelope,
    errorCodes: cardCollectionErrors,
  });
}

const cardRefreshErrors: Record<number, readonly string[]> = {
  ...cardCollectionErrors,
  429: ["LOST_ARK_RATE_LIMITED", "CARD_COLLECTION_REFRESH_COOLDOWN"],
};

/** Refill the roster card records (backend #138): one POST, up to ~10 s. */
export function requestCardRefresh(
  name: string,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<CardRefreshEnvelope>> {
  if (characterNameError(name)) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/card-collection/refresh");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  return requestBackend(url, {
    ...options,
    method: "POST",
    timeoutMs: options.timeoutMs ?? 30_000,
    isValid: isCardRefreshEnvelope,
    errorCodes: cardRefreshErrors,
  });
}

// Roster combat power (L19).
const rosterPowerErrors: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["CHARACTER_NOT_FOUND"],
  429: ["LOST_ARK_RATE_LIMITED", "CLIENT_RATE_LIMITED"],
  502: ["LOST_ARK_API_ERROR"],
  503: ["CHARACTER_STORAGE_UNAVAILABLE", "LOST_ARK_NOT_CONFIGURED", "CHARACTER_CACHE_UNAVAILABLE"],
  504: ["LOST_ARK_API_TIMEOUT"],
};
const rosterPowerRefreshErrors: Record<number, readonly string[]> = {
  ...rosterPowerErrors,
  429: ["ROSTER_REFRESH_COOLDOWN", "LOST_ARK_RATE_LIMITED", "CLIENT_RATE_LIMITED"],
};

export function requestRosterPower(
  name: string,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<RosterPowerEnvelope>> {
  if (characterNameError(name)) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/roster-combat-power");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  return requestBackend(url, { ...options, isValid: isRosterPowerEnvelope, errorCodes: rosterPowerErrors });
}

/** Reads up to 12 missing characters from the official profiles: several seconds. */
export function requestRosterPowerRefresh(
  name: string,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<RosterPowerRefreshEnvelope>> {
  if (characterNameError(name)) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/roster-combat-power/refresh");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  return requestBackend(url, {
    ...options,
    method: "POST",
    timeoutMs: options.timeoutMs ?? 30_000,
    isValid: isRosterPowerRefreshEnvelope,
    errorCodes: rosterPowerRefreshErrors,
  });
}
