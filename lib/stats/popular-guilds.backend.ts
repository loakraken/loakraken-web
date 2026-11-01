// Backend side of popular-guilds.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// popular-guilds.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/popular-guilds.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { POPULAR_GUILD_LIMIT, type PopularGuildsEnvelope, type PopularGuildsQuery } from "./popular-guilds";

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<PopularGuildsEnvelope>({
    $ref: "#/components/schemas/ApiResponseGuildPopularResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);

export const isPopularGuildsEnvelope = (value: unknown): value is PopularGuildsEnvelope =>
  validate(value) && value.code === "GUILD_POPULAR_SUCCESS";

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
