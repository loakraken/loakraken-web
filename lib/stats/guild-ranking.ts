// Guild ranking (backend #302, checklist L36·K28): guilds put together from the
// characters LOAKraken has observed with the same server and official guild
// name, by item level average or sum. Values are over the members seen, not the
// whole guild. Off on the backend until the screen ships; the screen follows
// GUILD_RANKING (lib/tools/flags.ts) the same way.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/guild-ranking.openapi.json";
import type { components } from "../api/guild-ranking-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type GuildRankingEnvelope = Schemas["ApiResponseGuildRankingResponse"];
export type GuildRanking = Schemas["GuildRankingResponse"];
type RolloutKey = "combatPowerAvgTop" | "combatPowerTopCount" | "combatPowerTotal";
/** A row; the 1750+ combat power fields are missing from a backend before api #589. */
export type GuildRow = Omit<Schemas["GuildRankingRowResponse"], RolloutKey> &
  Partial<Pick<Schemas["GuildRankingRowResponse"], RolloutKey>>;

// The 1750+ combat power fields (api #589) are required in the contract, but a
// backend from before them answers without: optional here until it is gone
// (the screen shows '-' for a missing value).
const ROLLOUT = ["combatPowerAvgTop", "combatPowerTopCount", "combatPowerTotal"];
const schemas = (() => {
  const all = tolerantSchemas(contract.components.schemas);
  const row = all.GuildRankingRowResponse;
  return { ...all, GuildRankingRowResponse: { ...row, required: row.required.filter((key) => !ROLLOUT.includes(key)) } };
})();
const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<GuildRankingEnvelope>({
    $ref: "#/components/schemas/ApiResponseGuildRankingResponse",
    components: { ...contract.components, schemas },
  }),
);
export const isGuildRankingEnvelope = (value: unknown): value is GuildRankingEnvelope =>
  validate(value) && value.code === "GUILD_RANKING_SUCCESS";

/** CP_AVG first and the default (api #589): the 1750+ members' combat power average. */
export const GUILD_SORTS = [
  { id: "CP_AVG", label: "전투력 평균" },
  { id: "CP_SUM", label: "전투력 합" },
  { id: "AVG", label: "아이템 레벨 평균" },
  { id: "SUM", label: "아이템 레벨 합" },
] as const;
export type GuildSort = (typeof GUILD_SORTS)[number]["id"];
/** guild: part of a guild name (api #466); rows keep their overall rank. */
export type GuildQuery = { sort: GuildSort; server?: string; guild?: string; page: number };

/** What the backend takes for a name: 1~12 letters or digits. */
export const isGuildName = (value: string) => value.length >= 1 && value.length <= 12 && /^[\p{L}\p{N}]+$/u.test(value);

export const GUILD_PAGE_SIZE = 50;
export const GUILD_MAX_PAGE = 200;
const isSort = (value: string | null): value is GuildSort => GUILD_SORTS.some((item) => item.id === value);

/** The item level a guild's 1750+ combat power average counts from (api #589). */
export const GUILD_TOP_LEVEL = 1750;

/** The value a row is ranked by; null (no 1750+ member seen, say) puts it last with no rank shown. */
export function guildValue(row: GuildRow, sort: GuildSort): number | null {
  if (sort === "CP_AVG") return row.combatPowerAvgTop ?? null;
  if (sort === "CP_SUM") return row.combatPowerTotal ?? null;
  return sort === "SUM" ? row.itemLevelSum : row.itemLevelAvg;
}

/** From a shared link; unknown values fall back to the defaults (1750+ combat power average, every server). */
export function parseGuildQuery(input: URLSearchParams): GuildQuery {
  const sort = input.get("sort");
  const server = input.get("server")?.trim();
  const guild = input.get("guild")?.trim();
  const page = Number(input.get("page") ?? 1);
  return {
    sort: isSort(sort) ? sort : "CP_AVG",
    server: server && server.length <= 16 && /^[\p{L}\p{N}]+$/u.test(server) ? server : undefined,
    guild: guild && isGuildName(guild) ? guild : undefined,
    page: Number.isInteger(page) && page >= 1 && page <= GUILD_MAX_PAGE ? page : 1,
  };
}

/** The screen's own parameters (type=guilds kept by the page); defaults left out. */
export function guildSearch(query: GuildQuery) {
  const out = new URLSearchParams({ type: "guilds" });
  if (query.sort !== "CP_AVG") out.set("sort", query.sort);
  if (query.server) out.set("server", query.server);
  if (query.guild) out.set("guild", query.guild);
  if (query.page > 1) out.set("page", String(query.page));
  return out;
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE"],
  503: ["STATS_UNAVAILABLE"],
};

export function requestGuildRanking(
  query: GuildQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<GuildRankingEnvelope>> {
  const url = backendUrl(origin, "/api/v1/rankings/guilds");
  if (url) {
    url.searchParams.set("sort", query.sort);
    if (query.server) url.searchParams.set("server", query.server);
    if (query.guild) url.searchParams.set("guild", query.guild);
    url.searchParams.set("page", String(query.page));
    url.searchParams.set("size", String(GUILD_PAGE_SIZE));
  }
  return requestBackend(url, { ...options, isValid: isGuildRankingEnvelope, errorCodes });
}
