// Statistics (B-3, backend #100): LOAWA's /stat and ILOA's /statistics over the
// characters LOAKraken has observed — never the whole game population.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/stats.openapi.json";
import type { components } from "../api/stats-schema";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type StatsMeta = Schemas["StatsMetaResponse"];
export type SummaryEnvelope = Schemas["ApiResponseStatsSummaryResponse"];
export type ClassesEnvelope = Schemas["ApiResponseStatsClassesResponse"];
export type ServersEnvelope = Schemas["ApiResponseStatsServersResponse"];
export type DistributionEnvelope = Schemas["ApiResponseStatsDistributionResponse"];
export type Summary = Schemas["StatsSummaryResponse"];
export type ClassRow = Schemas["StatsClassRowResponse"];
export type ServerRow = Schemas["StatsServerRowResponse"];
export type Distribution = Schemas["StatsDistributionResponse"];
export type Metric = Distribution["metric"];

export const STATS_VIEWS = ["summary", "classes", "servers", "distribution"] as const;
export type StatsView = (typeof STATS_VIEWS)[number];
export type StatsEnvelopes = {
  summary: SummaryEnvelope;
  classes: ClassesEnvelope;
  servers: ServersEnvelope;
  distribution: DistributionEnvelope;
};

const ajv = new Ajv2020({ strict: false, validateFormats: false });
ajv.addSchema({
  $id: "stats",
  components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
});
const SCHEMA: Record<StatsView, [string, string]> = {
  summary: ["ApiResponseStatsSummaryResponse", "STATS_SUMMARY_SUCCESS"],
  classes: ["ApiResponseStatsClassesResponse", "STATS_CLASSES_SUCCESS"],
  servers: ["ApiResponseStatsServersResponse", "STATS_SERVERS_SUCCESS"],
  distribution: ["ApiResponseStatsDistributionResponse", "STATS_DISTRIBUTION_SUCCESS"],
};
const validators = Object.fromEntries(
  STATS_VIEWS.map((view) => [view, lazyValidator(() => ajv.compile({ $ref: `stats#/components/schemas/${SCHEMA[view][0]}` }))]),
) as Record<StatsView, (value: unknown) => value is unknown>;

export function isStatsEnvelope<V extends StatsView>(view: V, value: unknown): value is StatsEnvelopes[V] {
  if (!validators[view](value)) return false;
  const envelope = value as { code: string; data: { meta: StatsMeta } };
  return envelope.code === SCHEMA[view][1] && Number.isFinite(Date.parse(envelope.data.meta.aggregatedAt));
}

/** Filters shared by every view, as the URL query of /stats and of the proxy. */
export type StatsQuery = {
  server?: string;
  role?: "DEALER" | "SUPPORT";
  activeDays?: 7 | 30 | 90;
  itemLevelMin?: number;
  itemLevelMax?: number;
  combatPowerMin?: number;
  combatPowerMax?: number;
  representativeOnly?: true;
  metric?: Metric;
  width?: number;
  percentileOf?: number;
};

const NAME = /^[\p{L}\p{N}]{1,32}$/u;
const number = (value: string | null, min: number, max: number) => {
  if (value == null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/**
 * Parses and allow-lists the filters; null when any given value is invalid
 * (the proxy answers 400 without calling the backend). Unknown keys are dropped.
 */
export function parseStatsQuery(input: URLSearchParams): StatsQuery | null {
  const out: StatsQuery = {};
  const server = input.get("server");
  if (server) {
    if (!NAME.test(server)) return null;
    out.server = server;
  }
  const role = input.get("role");
  if (role) {
    if (role !== "DEALER" && role !== "SUPPORT") return null;
    out.role = role;
  }
  const days = input.get("activeDays");
  if (days) {
    if (!["7", "30", "90"].includes(days)) return null;
    out.activeDays = Number(days) as 7 | 30 | 90;
  }
  for (const [key, max] of [
    ["itemLevelMin", 2000],
    ["itemLevelMax", 2000],
    ["combatPowerMin", 100000],
    ["combatPowerMax", 100000],
  ] as const) {
    const value = number(input.get(key), 0, max);
    if (value === null) return null;
    if (value !== undefined) out[key] = value;
  }
  if (input.get("representativeOnly") === "true") out.representativeOnly = true;
  const metric = input.get("metric");
  if (metric) {
    if (metric !== "COMBAT_POWER" && metric !== "ITEM_LEVEL") return null;
    out.metric = metric;
  }
  const width = number(input.get("width"), 0.01, 100000);
  if (width === null) return null;
  if (width !== undefined) out.width = width;
  const percentile = number(input.get("percentileOf"), 0, 100000);
  if (percentile === null) return null;
  if (percentile !== undefined) out.percentileOf = percentile;
  return out;
}

export function statsSearch(query: StatsQuery) {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== null) out.set(key, String(value));
  return out;
}

const count = (n: number) => n.toLocaleString("ko-KR");
export const fixed = (n: number | null | undefined, digits = 2) =>
  n == null ? "-" : n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const whole = (n: number | null | undefined) =>
  n == null ? "-" : n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
export const percent = (n: number | null | undefined) =>
  n == null ? "-" : `${n.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;

/**
 * A population share, always one decimal so a column lines up ("8.7%",
 * "5.0%"); a small but non-zero share is "<0.1%", never a false "0%".
 */
export function share(n: number | null | undefined) {
  if (n == null) return "-";
  if (n > 0 && n < 0.05) return "<0.1%";
  return `${n.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** The filters alone ("최근 30일 안에 확인 · 아이템 레벨 1,640 이상"), for under the basis line. */
export function sampleConditions(meta: StatsMeta) {
  return conditionParts(meta, "확인").join(" · ");
}

function conditionParts(meta: StatsMeta, seen: string) {
  const c = meta.conditions;
  const parts = [`최근 ${c.activeDays}일 안에 ${seen}`];
  if (c.itemLevelMin > 0) parts.push(`아이템 레벨 ${count(c.itemLevelMin)} 이상`);
  if (c.itemLevelMax != null) parts.push(`${count(c.itemLevelMax)} 이하`);
  if (c.server) parts.push(c.server);
  if (c.role) parts.push(c.role === "SUPPORT" ? "서포터" : "딜러");
  if (c.representativeOnly) parts.push("원정대 대표 캐릭터만");
  return parts;
}

/** The sample in words: who is counted, and that it is not the whole game. */
export function sampleText(meta: StatsMeta) {
  return `${conditionParts(meta, "LOAKraken이 확인한 캐릭터").join(" · ")} ${count(meta.population)}명 기준`;
}

/** Shared scale for the class quantile bars: the widest p10…p90 span. */
export function quantileScale(rows: ClassRow[]) {
  const ready = rows.flatMap((row) => (row.combatPower ? [row.combatPower] : []));
  if (!ready.length) return null;
  const min = Math.min(...ready.map((p) => p.p10));
  const max = Math.max(...ready.map((p) => p.p90));
  const span = max - min || 1;
  return (value: number) => ((value - min) / span) * 100;
}
