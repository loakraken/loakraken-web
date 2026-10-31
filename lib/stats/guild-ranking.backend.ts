// Backend side of guild-ranking.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// guild-ranking.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/guild-ranking.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { GUILD_PAGE_SIZE, type GuildRankingEnvelope, type GuildQuery } from "./guild-ranking";

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
