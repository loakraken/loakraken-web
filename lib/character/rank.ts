// Character ranking (F-7, backend #100/#112): rank, top percent and tier of a
// character among the characters LOAKraken has observed, as a ranking
// boxes (item level and combat power × all, server, class).
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/rank.openapi.json";
import type { components } from "../api/rank-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { characterNameError, normalizeCharacterName } from "./model";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type RankEnvelope = Schemas["ApiResponseStatsCharacterRankResponse"];
export type CharacterRank = Schemas["StatsCharacterRankResponse"];
export type RankEntry = Schemas["StatsRankEntryResponse"];
export type RankMetric = RankEntry["metric"];
export type RankScope = RankEntry["scope"];

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

/** PM decision: LOAKraken's own depth names; REST has none. */
export const TIER_LABEL: Record<string, string> = {
  TOP1: "크라켄",
  TOP5: "해구",
  TOP10: "심해",
  TOP25: "대양",
  TOP50: "연안",
};
const TIER_PERCENT: Record<string, number> = { TOP1: 1, TOP5: 5, TOP10: 10, TOP25: 25, TOP50: 50 };

export const METRICS: { id: RankMetric; label: string }[] = [
  { id: "COMBAT_POWER", label: "전투력" },
  { id: "ITEM_LEVEL", label: "아이템 레벨" },
];
export const SCOPES: { id: RankScope; label: string }[] = [
  { id: "ALL", label: "전체" },
  { id: "SERVER", label: "서버" },
  { id: "CLASS", label: "직업" },
  { id: "SERVER_CLASS", label: "서버 직업" },
];

/** The scopes to show: the server-class box only when the backend sent it. */
export function scopesOf(data: CharacterRank) {
  return SCOPES.filter((s) => s.id !== "SERVER_CLASS" || data.entries.some((e) => e.scope === s.id));
}

/**
 * What the whole panel shows. "excluded" is the ranking conditions (item
 * level, activity), not a request. A character on the operators' processing-
 * stop list gets the same 404 as one with no record (backend #366), so there
 * is no hidden state any more and the two cannot be told apart.
 */
export function rankState(data: CharacterRank): "excluded" | "ranked" {
  return data.included ? "ranked" : "excluded";
}

export type RankCell =
  | { state: "none" }
  | { state: "collecting"; total: number }
  | {
      state: "ready";
      rank: string;
      total: string;
      top: string | null;
      tier: string | null;
      tierNote: string | null;
      /** "해구까지 전투력 312.45" (L2); null when there is no next tier. */
      next: string | null;
    };

const count = (n: number) => n.toLocaleString("ko-KR");

/** One box: a metric within a scope. Collecting never shows 0 or a guess. */
/**
 * What is left to the next tier (api #481): its name and the gap in the
 * ranking's own unit. None at the top tier, under the sample minimum, or when
 * too few are counted for that tier to have a boundary.
 */
export function nextTierText(
  entry: { nextTier?: string | null; nextTierGap?: number | null },
  metric: RankMetric,
) {
  const next = entry.nextTier && Object.hasOwn(TIER_LABEL, entry.nextTier) ? TIER_LABEL[entry.nextTier] : null;
  if (!next || entry.nextTierGap == null || !(entry.nextTierGap > 0)) return null;
  const unit = metric === "ITEM_LEVEL" ? "아이템 레벨" : "전투력";
  return `${next}까지 ${unit} ${entry.nextTierGap.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function rankCell(data: CharacterRank, metric: RankMetric, scope: RankScope): RankCell {
  const entry = data.entries.find((e) => e.metric === metric && e.scope === scope);
  if (!entry) return { state: "none" };
  if (entry.sampleStatus !== "READY") return { state: "collecting", total: entry.total };
  const tier = entry.tier && Object.hasOwn(TIER_LABEL, entry.tier) ? entry.tier : null;
  return {
    state: "ready",
    rank: `${count(entry.rank)}위`,
    total: `${count(entry.total)}명 중`,
    top:
      entry.topPercent == null
        ? null
        : `상위 ${entry.topPercent.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`,
    tier: tier && TIER_LABEL[tier],
    tierNote:
      tier &&
      `${METRICS.find((m) => m.id === metric)?.label} 순위에서 상위 ${TIER_PERCENT[tier]}% 이내예요(LOAKraken이 확인한 캐릭터 기준).`,
    next: nextTierText(entry, metric),
  };
}

/**
 * Visible legend: 크라켄 1% · 해구 5% · … 이내. Callers say which ranking the
 * share is of (user 10-12 asked what "연안 크라켄" meant).
 */
export const TIER_LEGEND = `${Object.entries(TIER_LABEL)
  .map(([tier, label]) => `${label} ${TIER_PERCENT[tier]}%`)
  .join(" · ")} 이내`;

/** Scope label with its value: 서버 · 루페온, 직업 · 바드, 서버 직업 · 루페온 바드. */
export function scopeLabel(data: CharacterRank, scope: RankScope) {
  const label = SCOPES.find((s) => s.id === scope)?.label ?? scope;
  const value = data.entries.find((e) => e.scope === scope)?.scopeValue;
  return value ? `${label} · ${value.replace("/", " ")}` : label;
}

/** The population the ranks are over, in words (never the whole game). */
export function conditionsText(data: CharacterRank) {
  const c = data.conditions;
  const level = c.itemLevelMin > 0 ? ` 아이템 레벨 ${count(c.itemLevelMin)} 이상` : "";
  return `LOAKraken이 최근 ${c.activeDays}일 안에 확인한${level} 캐릭터 기준`;
}

/**
 * The banner line (§14.1 ⑤): combat power over everyone seen, only when that
 * box is ready and the character is ranked; otherwise nothing (no 0, no guess).
 */
export function bannerRank(data: CharacterRank) {
  if (rankState(data) !== "ranked") return null;
  const cell = rankCell(data, "COMBAT_POWER", "ALL");
  if (cell.state !== "ready") return null;
  const value = `${cell.rank}${cell.top ? ` · ${cell.top}` : ""}`;
  return {
    tier: cell.tier,
    /** The metric's name, shown apart so a narrow banner can leave it out (the number line above says it). */
    label: "전투력",
    value,
    text: `전투력 ${value}`,
    note: `${conditionsText(data)} ${cell.total} 순위예요. 공식 순위가 아니에요.`,
  };
}
