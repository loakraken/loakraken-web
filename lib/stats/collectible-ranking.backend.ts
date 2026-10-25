// Backend side of collectible-ranking.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// collectible-ranking.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/collectible-ranking.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { COLLECTIBLE_PAGE_SIZE, type CollectibleRankingEnvelope, type CollectibleQuery } from "./collectible-ranking";

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<CollectibleRankingEnvelope>({
    $ref: "#/components/schemas/ApiResponseCollectibleRankingResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);

export const isCollectibleRankingEnvelope = (value: unknown): value is CollectibleRankingEnvelope =>
  validate(value) && value.code === "COLLECTIBLE_RANKING_SUCCESS";

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE"],
  503: ["STATS_UNAVAILABLE"],
};

export function requestCollectibleRanking(
  query: CollectibleQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<CollectibleRankingEnvelope>> {
  const url = backendUrl(origin, "/api/v1/rankings/collectibles");
  if (url) {
    url.searchParams.set("unit", query.unit);
    if (query.server) url.searchParams.set("server", query.server);
    url.searchParams.set("activeDays", String(query.activeDays));
    url.searchParams.set("page", String(query.page));
    url.searchParams.set("size", String(COLLECTIBLE_PAGE_SIZE));
  }
  return requestBackend(url, { ...options, isValid: isCollectibleRankingEnvelope, errorCodes });
}
