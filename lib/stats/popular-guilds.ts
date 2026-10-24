// Popular guilds (backend #467, checklist M21): guilds ranked by the views
// of their members' character pages on LOAKraken (the popular characters'
// count: the same viewer and character once a KST day), last 24 hours or 7
// days. Only rank, server and guild name come back; counts are never shown.
// Opens on the backend only with both the popular characters and the guild
// ranking flags on (404 otherwise); the screen follows POPULAR_GUILDS.

import type { components } from "../api/popular-guilds-schema";

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
