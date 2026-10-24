// Character ranking list (backend #100 /rankings): 랭킹 over the
// characters LOAKraken has observed. Hidden characters are never listed.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/rankings.openapi.json";
import type { components } from "../api/rankings-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { conditionsKey, parseStatsQuery, statsSearch, type Metric, type StatsQuery } from "./model";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type RankingEnvelope = Schemas["ApiResponseStatsRankingResponse"];
export type Ranking = Schemas["StatsRankingResponse"];
export type RankedCharacter = Schemas["StatsRankedCharacterResponse"];
export type EfficiencyEnvelope = Schemas["ApiResponseStatsEfficiencyRankingResponse"];
export type EfficiencyRanking = Schemas["StatsEfficiencyRankingResponse"];
export type EfficiencyRow = Schemas["StatsEfficiencyRankedCharacterResponse"];

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

/** 팔찌 효율 · 젬 효율 랭킹 (api #444, checklist L38·L39). */
export const EFFICIENCY_KINDS = {
  bracelets: { path: "/api/v1/rankings/bracelets", label: "팔찌", value: "팔찌 효율" },
  gems: { path: "/api/v1/rankings/ark-grid-gems", label: "젬", value: "젬 효율" },
} as const;
export type EfficiencyKind = keyof typeof EFFICIENCY_KINDS;

/** The efficiency ranking's query key: the page fills it on the server, the view reads it. */
export const efficiencyKey = (kind: EfficiencyKind, query: EfficiencyQuery) =>
  ["efficiency-ranking", kind, conditionsKey(efficiencySearch(kind, query))] as const;

/**
 * What the ranked value means, by the answer's ruleVersion (api #647): the
 * real definition (bracelet-real-* / ark-grid-real-*) is the character
 * screen's own efficiency; any other version is the combat power one.
 */
export function efficiencyDefinition(kind: EfficiencyKind, ruleVersion: string) {
  const real = /^(bracelet|ark-grid)-real-/.test(ruleVersion);
  if (kind === "bracelets")
    return real
      ? "팔찌 효율은 팔찌가 딜을 몇 % 올려 주는지예요. 캐릭터 화면의 팔찌 효율과 같은 값이에요."
      : "팔찌 효율은 팔찌가 전투력을 몇 % 올려 주는지예요. 팔찌를 뺀 전투력과 비교했어요.";
  return real
    ? "젬 효율은 아크 그리드 젬(옵션·코어 포인트)이 딜을 몇 % 올려 주는지예요. 캐릭터 화면의 아크 그리드 효율과 같은 값이에요."
    : "젬 효율은 아크 그리드 젬 옵션이 전투력을 몇 % 올려 주는지예요(코어 제외). 젬 옵션을 뺀 전투력과 비교했어요.";
}
/** The character ranking's filters without its metric (efficiency is the order). */
export type EfficiencyQuery = Omit<RankingQuery, "metric">;

export function isEfficiencyEnvelope(value: unknown): value is EfficiencyEnvelope {
  return (
    validateEfficiency(value) &&
    value.code === "RANKING_SUCCESS" &&
    Number.isFinite(Date.parse(value.data.meta.aggregatedAt))
  );
}

/** From a shared link; invalid values fall back to the defaults. */
export function parseEfficiencyQuery(input: URLSearchParams): EfficiencyQuery {
  const params = new URLSearchParams(input);
  params.delete("type");
  params.delete("metric");
  const parsed = parseRankingQuery(params);
  if (!parsed) return { page: 1 };
  const { metric: _metric, ...rest } = parsed;
  void _metric;
  return rest;
}

/** The screen's own parameters (type kept), defaults left out. */
export function efficiencySearch(kind: EfficiencyKind, query: EfficiencyQuery) {
  const out = rankingSearch({ ...query, metric: "COMBAT_POWER" });
  out.set("type", kind);
  return out;
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

/** "+25 · 엘라 2단계", "+25", "엘라 2단계" or null (shown as '-'). */
export function estherText(weapon: RankedCharacter["estherWeapon"] | undefined) {
  if (!weapon) return null;
  const parts = [
    weapon.refineLevel != null ? `+${weapon.refineLevel}` : null,
    weapon.ellaStage != null ? `엘라 ${weapon.ellaStage}단계` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** "진화 140 · 깨달음 101 · 도약 70" (missing ones left out) or null. */
export function arkPassiveText(points: RankedCharacter["arkPassivePoints"] | undefined) {
  if (!points) return null;
  const parts = [
    points.evolution != null ? `진화 ${points.evolution}` : null,
    points.enlightenment != null ? `깨달음 ${points.enlightenment}` : null,
    points.leap != null ? `도약 ${points.leap}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
