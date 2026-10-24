// Backend side of rankings.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// rankings.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/rankings.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { rankingSearch, PAGE_SIZE, EFFICIENCY_KINDS, type RankingEnvelope, type EfficiencyEnvelope, type RankingQuery, type EfficiencyKind, type EfficiencyQuery } from "./rankings";

/**
 * Fields added after the first ranking release (api #446·#449, K32/L37, and
 * meta.populationUnit):
 * a backend that does not send them yet still passes, and the screen shows
 * '-' for them (no placeholder column is dropped).
 */
const ROLLOUT_ROW_FIELDS = ["bestCombatPower", "arkPassivePoints", "classEngraving", "estherWeapon"];

function rankingSchemas() {
  const schemas = tolerantSchemas(contract.components.schemas) as Record<string, { required?: string[] }>;
  const row = schemas.StatsRankedCharacterResponse;
  if (row?.required) row.required = row.required.filter((name) => !ROLLOUT_ROW_FIELDS.includes(name));
  // meta.populationUnit came with the same backend release.
  const meta = schemas.StatsMetaResponse;
  if (meta?.required) meta.required = meta.required.filter((name) => name !== "populationUnit");
  return schemas;
}

const validate = lazyValidator(() => new Ajv2020({ strict: false, validateFormats: false }).compile<RankingEnvelope>({
  $ref: "#/components/schemas/ApiResponseStatsRankingResponse",
  components: { ...contract.components, schemas: rankingSchemas() },
}));

const validateEfficiency = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<EfficiencyEnvelope>({
    $ref: "#/components/schemas/ApiResponseStatsEfficiencyRankingResponse",
    components: { ...contract.components, schemas: rankingSchemas() },
  }),
);

export function isRankingEnvelope(value: unknown): value is RankingEnvelope {
  return (
    validate(value) &&
    value.code === "RANKING_SUCCESS" &&
    Number.isFinite(Date.parse(value.data.meta.aggregatedAt))
  );
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE"],
  429: ["LOST_ARK_RATE_LIMITED"],
  503: ["STATS_UNAVAILABLE"],
};

export function requestRankings(
  query: RankingQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<RankingEnvelope>> {
  const url = backendUrl(origin, "/api/v1/rankings");
  if (url) {
    const params = rankingSearch(query);
    params.set("metric", query.metric);
    params.set("page", String(query.page));
    params.set("size", String(PAGE_SIZE));
    url.search = params.toString();
  }
  return requestBackend(url, { ...options, isValid: isRankingEnvelope, errorCodes });
}

export function isEfficiencyEnvelope(value: unknown): value is EfficiencyEnvelope {
  return (
    validateEfficiency(value) &&
    value.code === "RANKING_SUCCESS" &&
    Number.isFinite(Date.parse(value.data.meta.aggregatedAt))
  );
}

export function requestEfficiencyRanking(
  kind: EfficiencyKind,
  query: EfficiencyQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<EfficiencyEnvelope>> {
  const url = backendUrl(origin, EFFICIENCY_KINDS[kind].path);
  if (url) {
    const params = rankingSearch({ ...query, metric: "COMBAT_POWER" });
    params.delete("metric");
    params.set("page", String(query.page));
    params.set("size", String(PAGE_SIZE));
    url.search = params.toString();
  }
  return requestBackend(url, { ...options, isValid: isEfficiencyEnvelope, errorCodes });
}
