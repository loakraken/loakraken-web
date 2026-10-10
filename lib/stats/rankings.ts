// Character ranking list (backend #100 /rankings): LOAWA's 랭킹 over the
// characters LOAKraken has observed. Hidden characters are never listed.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/rankings.openapi.json";
import type { components } from "../api/rankings-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { parseStatsQuery, statsSearch, type Metric, type StatsQuery } from "./model";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type RankingEnvelope = Schemas["ApiResponseStatsRankingResponse"];
export type Ranking = Schemas["StatsRankingResponse"];
export type RankedCharacter = Schemas["StatsRankedCharacterResponse"];

const validate = lazyValidator(() => new Ajv2020({ strict: false, validateFormats: false }).compile<RankingEnvelope>({
  $ref: "#/components/schemas/ApiResponseStatsRankingResponse",
  components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
}));

export function isRankingEnvelope(value: unknown): value is RankingEnvelope {
  return (
    validate(value) &&
    value.code === "RANKING_SUCCESS" &&
    Number.isFinite(Date.parse(value.data.meta.aggregatedAt))
  );
}

export const PAGE_SIZE = 50;
export const MAX_PAGE = 200;
export type RankingQuery = StatsQuery & { metric: Metric; page: number; className?: string };

const NAME = /^[\p{L}\p{N}]{1,32}$/u;

/** Filters plus metric (default combat power), page and class; null when invalid. */
export function parseRankingQuery(input: URLSearchParams): RankingQuery | null {
  const filters = new URLSearchParams(input);
  for (const key of ["metric", "page", "className", "width", "percentileOf"]) filters.delete(key);
  const base = parseStatsQuery(filters);
  if (!base) return null;
  const metric = input.get("metric") ?? "COMBAT_POWER";
  if (metric !== "COMBAT_POWER" && metric !== "ITEM_LEVEL") return null;
  const pageText = input.get("page") ?? "1";
  const page = /^\d{1,3}$/.test(pageText) ? Number(pageText) : NaN;
  if (!(page >= 1 && page <= MAX_PAGE)) return null;
  const className = input.get("className") || undefined;
  if (className && !NAME.test(className)) return null;
  return { ...base, metric, page, ...(className && { className }) };
}

export function rankingSearch(query: RankingQuery) {
  const { page, metric, className, ...filters } = query;
  const out = statsSearch(filters);
  if (metric !== "COMBAT_POWER") out.set("metric", metric);
  if (className) out.set("className", className);
  if (page > 1) out.set("page", String(page));
  return out;
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
