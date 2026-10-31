// Backend side of rank.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// rank.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/rank.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { characterNameError, normalizeCharacterName } from "./model";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { type RankEnvelope } from "./rank";

// Response enums loosened (#125): an unknown tier or scope affects that cell only.
const validate = lazyValidator(() => new Ajv2020({ strict: false, validateFormats: false }).compile<RankEnvelope>({
  $ref: "#/components/schemas/ApiResponseStatsCharacterRankResponse",
  components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
}));

const isTime = (value: string) => Number.isFinite(Date.parse(value));

export function isRankEnvelope(value: unknown): value is RankEnvelope {
  return (
    validate(value) &&
    value.code === "CHARACTER_RANK_SUCCESS" &&
    isTime(value.data.aggregatedAt)
  );
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE"],
  404: ["STATS_CHARACTER_NOT_OBSERVED"],
  503: ["STATS_UNAVAILABLE"],
};

const invalid = { ok: false as const, error: { code: "INVALID_REQUEST", status: 400 } };

/** Default conditions (last 30 days, item level 1,640+), as the backend defaults. */
export function requestRank(
  name: string,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<RankEnvelope>> {
  if (characterNameError(name)) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/rank");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  return requestBackend(url, { ...options, isValid: isRankEnvelope, errorCodes });
}
