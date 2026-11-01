// Backend side of titles.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// titles.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/titles.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { characterNameError, normalizeCharacterName } from "./model";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { type TitlesEnvelope } from "./titles";

const schemas = tolerantSchemas(contract.components.schemas);

const title = schemas.RosterTitleResponse as { required?: string[] };

title.required = title.required?.filter((field) => field !== "firstObservedDate");

const validate = lazyValidator(() => new Ajv2020({ strict: false, validateFormats: false }).compile<TitlesEnvelope>({
  $ref: "#/components/schemas/ApiResponseRosterTitlesResponse",
  components: { ...contract.components, schemas },
}));

const isTime = (value: string) => Number.isFinite(Date.parse(value));

export function isTitlesEnvelope(value: unknown): value is TitlesEnvelope {
  return (
    validate(value) &&
    value.code === "CHARACTER_TITLES_SUCCESS" &&
    value.data.titles.every((t) => isTime(t.firstObservedAt) && isTime(t.lastObservedAt))
  );
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["CHARACTER_NOT_FOUND"],
  429: ["LOST_ARK_RATE_LIMITED"],
  502: ["LOST_ARK_API_ERROR"],
  503: [
    "CHARACTER_HISTORY_DISABLED",
    "CHARACTER_HISTORY_UNAVAILABLE",
    "LOST_ARK_NOT_CONFIGURED",
    "CHARACTER_CACHE_UNAVAILABLE",
  ],
  504: ["LOST_ARK_API_TIMEOUT"],
};

const invalid = { ok: false as const, error: { code: "INVALID_REQUEST", status: 400 } };

export function requestTitles(
  name: string,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<TitlesEnvelope>> {
  if (characterNameError(name)) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/titles");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  return requestBackend(url, { ...options, isValid: isTitlesEnvelope, errorCodes });
}
