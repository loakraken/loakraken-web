// Backend side of gem-levels.ts: response validation (Ajv + the contract) and the
// request that uses it. Server code and tests only — the client imports
// gem-levels.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/stats-gem-levels.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { gemLevelsSearch, type GemLevelsEnvelope } from "./gem-levels";
import type { StatsQuery } from "./model";

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<GemLevelsEnvelope>({
    $ref: "#/components/schemas/ApiResponseStatsGemLevelsResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);

export const isGemLevelsEnvelope = (value: unknown): value is GemLevelsEnvelope =>
  validate(value) && value.code === "STATS_GEM_LEVELS_SUCCESS";

const errorCodes: Record<number, readonly string[]> = {
  // 404: the api has no such endpoint yet (before it ships) - the screen leaves the chart out.
  404: ["NOT_FOUND"],
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE"],
  503: ["STATS_UNAVAILABLE"],
};

export function requestGemLevels(
  query: StatsQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<GemLevelsEnvelope>> {
  const url = backendUrl(origin, "/api/v1/stats/gem-levels");
  if (url) for (const [key, value] of gemLevelsSearch(query)) url.searchParams.set(key, value);
  return requestBackend(url, { ...options, isValid: isGemLevelsEnvelope, errorCodes });
}
