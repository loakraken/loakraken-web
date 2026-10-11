// Roster ranking (backend #298): rosters LOAKraken has observed, ranked by
// the top six characters' average or sum (or every character's average) of
// combat power or item level. Off on the backend until the screen ships; the
// screen follows ROSTER_RANKING (lib/tools/flags.ts) the same way.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/roster-ranking.openapi.json";
import type { components } from "../api/roster-ranking-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type RosterRankingEnvelope = Schemas["ApiResponseRosterRankingResponse"];
export type RosterRanking = Schemas["RosterRankingResponse"];
export type RosterRow = Schemas["RosterRankingRowResponse"];

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<RosterRankingEnvelope>({
    $ref: "#/components/schemas/ApiResponseRosterRankingResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);
export const isRosterRankingEnvelope = (value: unknown): value is RosterRankingEnvelope =>
  validate(value) && value.code === "ROSTER_RANKING_SUCCESS";

export const ROSTER_BASES = [
  { id: "COMBAT_POWER", label: "전투력" },
  { id: "ITEM_LEVEL", label: "아이템 레벨" },
] as const;
export const ROSTER_AGGREGATES = [
  { id: "TOP6_AVG", label: "식스맨 평균" },
  { id: "TOP6_SUM", label: "상위 6명 합" },
  { id: "ALL_AVG", label: "전체 평균" },
] as const;
export type RosterBasis = (typeof ROSTER_BASES)[number]["id"];
export type RosterAggregate = (typeof ROSTER_AGGREGATES)[number]["id"];
export type RosterQuery = { basis: RosterBasis; aggregate: RosterAggregate; server?: string; page: number };

export const ROSTER_PAGE_SIZE = 50;
export const ROSTER_MAX_PAGE = 200;
const isBasis = (value: string | null): value is RosterBasis => ROSTER_BASES.some((item) => item.id === value);
const isAggregate = (value: string | null): value is RosterAggregate => ROSTER_AGGREGATES.some((item) => item.id === value);

/** From a shared link; unknown values fall back to the defaults (combat power, top six average). */
export function parseRosterQuery(input: URLSearchParams): RosterQuery {
  const basis = input.get("basis");
  const aggregate = input.get("aggregate");
  const server = input.get("server")?.trim();
  const page = Number(input.get("page") ?? 1);
  return {
    basis: isBasis(basis) ? basis : "COMBAT_POWER",
    aggregate: isAggregate(aggregate) ? aggregate : "TOP6_AVG",
    server: server && server.length <= 16 && /^[\p{L}\p{N}]+$/u.test(server) ? server : undefined,
    page: Number.isInteger(page) && page >= 1 && page <= ROSTER_MAX_PAGE ? page : 1,
  };
}

/** The screen's own parameters (type=roster kept by the page); defaults left out. */
export function rosterSearch(query: RosterQuery) {
  const out = new URLSearchParams({ type: "roster" });
  if (query.basis !== "COMBAT_POWER") out.set("basis", query.basis);
  if (query.aggregate !== "TOP6_AVG") out.set("aggregate", query.aggregate);
  if (query.server) out.set("server", query.server);
  if (query.page > 1) out.set("page", String(query.page));
  return out;
}

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
