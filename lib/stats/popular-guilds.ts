// Popular guilds (backend #467, checklist M21): guilds ranked by the views
// of their members' character pages on LOAKraken (the popular characters'
// count: the same viewer and character once a KST day), last 24 hours or 7
// days. Only rank, server and guild name come back; counts are never shown.
// Opens on the backend only with both the popular characters and the guild
// ranking flags on (404 otherwise); the screen follows POPULAR_GUILDS.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/popular-guilds.openapi.json";
import type { components } from "../api/popular-guilds-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type PopularGuildsEnvelope = Schemas["ApiResponseGuildPopularResponse"];
export type PopularGuilds = Schemas["GuildPopularResponse"];
export type PopularGuildsPeriod = "24h" | "7d";
export const POPULAR_GUILD_PERIODS: readonly { id: PopularGuildsPeriod; label: string }[] = [
  { id: "24h", label: "24시간" },
  { id: "7d", label: "7일" },
];
/** The card's period in the address (home and the guild ranking); 24h is left out. */
export const GUILD_PERIOD_PARAM = "guildPeriod";
/** Anything but a known period is the default. */
export const popularGuildsPeriodOf = (value: string | null | undefined): PopularGuildsPeriod =>
  POPULAR_GUILD_PERIODS.some((p) => p.id === value) ? (value as PopularGuildsPeriod) : "24h";
/** Rows the card shows (and keeps room for). */
export const POPULAR_GUILD_LIMIT = 10;
export type PopularGuildsQuery = { period: PopularGuildsPeriod; server?: string };

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<PopularGuildsEnvelope>({
    $ref: "#/components/schemas/ApiResponseGuildPopularResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);
export const isPopularGuildsEnvelope = (value: unknown): value is PopularGuildsEnvelope =>
  validate(value) && value.code === "GUILD_POPULAR_SUCCESS";

const isPeriod = (value: string | null): value is PopularGuildsPeriod => value === "24h" || value === "7d";

/** From the proxy's query string; anything unexpected falls back to 24 hours, every server. */
export function parsePopularGuildsQuery(input: URLSearchParams): PopularGuildsQuery {
  const period = input.get("period");
  const server = input.get("server")?.trim();
  return {
    period: isPeriod(period) ? period : "24h",
    server: server && server.length <= 16 && /^[\p{L}\p{N}]+$/u.test(server) ? server : undefined,
  };
}

export function popularGuildsSearch(query: PopularGuildsQuery) {
  const out = new URLSearchParams({ period: query.period });
  if (query.server) out.set("server", query.server);
  return out;
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  503: ["CHARACTER_POPULAR_DISABLED", "CHARACTER_POPULAR_UNAVAILABLE"],
};

export function requestPopularGuilds(
  query: PopularGuildsQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<PopularGuildsEnvelope>> {
  const url = backendUrl(origin, "/api/v1/guilds/popular");
  if (url) {
    url.searchParams.set("period", query.period);
    if (query.server) url.searchParams.set("server", query.server);
    url.searchParams.set("limit", String(POPULAR_GUILD_LIMIT));
  }
  return requestBackend(url, { ...options, isValid: isPopularGuildsEnvelope, errorCodes });
}
