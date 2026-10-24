// Backend side of roster-ranking.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// roster-ranking.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/roster-ranking.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { ROSTER_PAGE_SIZE, type RosterRankingEnvelope, type RosterQuery } from "./roster-ranking";

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<RosterRankingEnvelope>({
    $ref: "#/components/schemas/ApiResponseRosterRankingResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);

export const isRosterRankingEnvelope = (value: unknown): value is RosterRankingEnvelope =>
  validate(value) && value.code === "ROSTER_RANKING_SUCCESS";

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE"],
  503: ["STATS_UNAVAILABLE"],
};

export function requestRosterRanking(
  query: RosterQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<RosterRankingEnvelope>> {
  const url = backendUrl(origin, "/api/v1/rankings/rosters");
  if (url) {
    url.searchParams.set("basis", query.basis);
    url.searchParams.set("aggregate", query.aggregate);
    if (query.server) url.searchParams.set("server", query.server);
    url.searchParams.set("page", String(query.page));
    url.searchParams.set("size", String(ROSTER_PAGE_SIZE));
  }
  return requestBackend(url, { ...options, isValid: isRosterRankingEnvelope, errorCodes });
}
