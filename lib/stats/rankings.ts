// Character ranking list (backend #100 /rankings): 랭킹 over the
// characters LOAKraken has observed. Hidden characters are never listed.

import type { components } from "../api/rankings-schema";

import { parseStatsQuery, statsSearch, type Metric, type StatsQuery } from "./model";

type Schemas = components["schemas"];
export type RankingEnvelope = Schemas["ApiResponseStatsRankingResponse"];
export type Ranking = Schemas["StatsRankingResponse"];
export type RankedCharacter = Schemas["StatsRankedCharacterResponse"];
export type EfficiencyEnvelope = Schemas["ApiResponseStatsEfficiencyRankingResponse"];
export type EfficiencyRanking = Schemas["StatsEfficiencyRankingResponse"];
export type EfficiencyRow = Schemas["StatsEfficiencyRankedCharacterResponse"];

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

/** 팔찌 효율 · 젬 효율 랭킹 (api #444, checklist L38·L39). */
export const EFFICIENCY_KINDS = {
  bracelets: { path: "/api/v1/rankings/bracelets", label: "팔찌", value: "팔찌 효율" },
  gems: { path: "/api/v1/rankings/ark-grid-gems", label: "젬", value: "젬 효율" },
} as const;
export type EfficiencyKind = keyof typeof EFFICIENCY_KINDS;
/** The character ranking's filters without its metric (efficiency is the order). */
export type EfficiencyQuery = Omit<RankingQuery, "metric">;

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
