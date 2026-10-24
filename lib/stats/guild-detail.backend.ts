// Backend side of guild-detail.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// guild-detail.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/guild-detail.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { type GuildDetailEnvelope, type GuildDetailQuery } from "./guild-detail";

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<GuildDetailEnvelope>({
    $ref: "#/components/schemas/ApiResponseGuildDetailResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);

export const isGuildDetailEnvelope = (value: unknown): value is GuildDetailEnvelope =>
  validate(value) && value.code === "GUILD_DETAIL_SUCCESS";

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
