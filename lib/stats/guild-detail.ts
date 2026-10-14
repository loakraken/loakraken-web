// Guild tab (backend #472·#475, checklist L36·K28·M10): one guild as LOAKraken
// has seen it — the public members whose profile was observed in the last
// 7·30·90 days (the guild ranking's member count), their grades, item level
// and combat power averages, medians and spread, and the classes. A sample,
// never the whole guild; processing-stop characters are left out by the backend.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/guild-detail.openapi.json";
import type { components } from "../api/guild-detail-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type GuildDetailEnvelope = Schemas["ApiResponseGuildDetailResponse"];
export type GuildDetail = Schemas["GuildDetailResponse"];
export type GuildMember = Schemas["GuildMemberResponse"];
export type GuildBin = Schemas["GuildBin"];

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<GuildDetailEnvelope>({
    $ref: "#/components/schemas/ApiResponseGuildDetailResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);
export const isGuildDetailEnvelope = (value: unknown): value is GuildDetailEnvelope =>
  validate(value) && value.code === "GUILD_DETAIL_SUCCESS";

export const GUILD_DAYS = [7, 30, 90] as const;
export type GuildDays = (typeof GUILD_DAYS)[number];
export type GuildDetailQuery = { serverName: string; guildName: string; activeDays: GuildDays };

/** Server 1~16 and guild 1~12 letters or digits, as the backend checks. */
const isName = (value: string, max: number) => value.length >= 1 && value.length <= max && /^[\p{L}\p{N}]+$/u.test(value);
export const isGuildDetailQuery = (serverName: string, guildName: string) => isName(serverName, 16) && isName(guildName, 12);

export function parseGuildDetailQuery(serverName: string, guildName: string, input: URLSearchParams): GuildDetailQuery | null {
  if (!isGuildDetailQuery(serverName, guildName)) return null;
  const days = Number(input.get("activeDays") ?? 30);
  return { serverName, guildName, activeDays: (GUILD_DAYS as readonly number[]).includes(days) ? (days as GuildDays) : 30 };
}

export const guildDetailPath = (query: GuildDetailQuery) =>
  `/api/guilds/${encodeURIComponent(query.serverName)}/${encodeURIComponent(query.guildName)}?activeDays=${query.activeDays}`;

export const guildDetailKey = (query: GuildDetailQuery) =>
  ["guild-detail", query.serverName, query.guildName, query.activeDays] as const;

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["STATS_GUILD_NOT_OBSERVED"],
  503: ["STATS_UNAVAILABLE"],
};

export function requestGuildDetail(
  query: GuildDetailQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<GuildDetailEnvelope>> {
  const url = backendUrl(
    origin,
    `/api/v1/guilds/${encodeURIComponent(query.serverName)}/${encodeURIComponent(query.guildName)}`,
  );
  url?.searchParams.set("activeDays", String(query.activeDays));
  return requestBackend(url, { ...options, isValid: isGuildDetailEnvelope, errorCodes });
}

/** Bins with their upper end, for "1,680~1,690" style labels. */
export const binLabel = (bins: GuildBin[], i: number, width: number, digits = 0) => {
  const from = Number(bins[i].from);
  const fmt = (n: number) => n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${fmt(from)}~${fmt(from + width)}`;
};
