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
export type GuildRow = Schemas["GuildRankingRowResponse"];

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<GuildRankingEnvelope>({
    $ref: "#/components/schemas/ApiResponseGuildRankingResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);
export const isGuildRankingEnvelope = (value: unknown): value is GuildRankingEnvelope =>
  validate(value) && value.code === "GUILD_RANKING_SUCCESS";

export const GUILD_SORTS = [
  { id: "AVG", label: "아이템 레벨 평균" },
  { id: "SUM", label: "아이템 레벨 합" },
] as const;
export type GuildSort = (typeof GUILD_SORTS)[number]["id"];
export type GuildQuery = { sort: GuildSort; server?: string; page: number };

export const GUILD_PAGE_SIZE = 50;
export const GUILD_MAX_PAGE = 200;
const isSort = (value: string | null): value is GuildSort => GUILD_SORTS.some((item) => item.id === value);

/** From a shared link; unknown values fall back to the defaults (average, every server). */
export function parseGuildQuery(input: URLSearchParams): GuildQuery {
  const sort = input.get("sort");
  const server = input.get("server")?.trim();
  const page = Number(input.get("page") ?? 1);
  return {
    sort: isSort(sort) ? sort : "AVG",
    server: server && server.length <= 16 && /^[\p{L}\p{N}]+$/u.test(server) ? server : undefined,
    page: Number.isInteger(page) && page >= 1 && page <= GUILD_MAX_PAGE ? page : 1,
  };
}

/** The screen's own parameters (type=guilds kept by the page); defaults left out. */
export function guildSearch(query: GuildQuery) {
  const out = new URLSearchParams({ type: "guilds" });
  if (query.sort !== "AVG") out.set("sort", query.sort);
  if (query.server) out.set("server", query.server);
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
    url.searchParams.set("page", String(query.page));
    url.searchParams.set("size", String(GUILD_PAGE_SIZE));
  }
  return requestBackend(url, { ...options, isValid: isGuildRankingEnvelope, errorCodes });
}
