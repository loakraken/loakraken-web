// 전체 인구 (stats B5, api #788): every character LOAKraken has stored with an
// item level — no filters, the stop list left out — counted by server, class
// and 10-level item level bucket in a weekly snapshot. Characters under 1640
// come from roster lists (no combat power or role), so they only show in
// 레벨별. snapshotDate is null until the first snapshot.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/stats-population.openapi.json";
import type { components } from "../api/stats-population-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type PopulationEnvelope = Schemas["ApiResponseStatsPopulationResponse"];
export type Population = Schemas["StatsPopulationResponse"];
export type PopulationCount = Schemas["StatsPopulationCountResponse"];

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<PopulationEnvelope>({
    $ref: "#/components/schemas/ApiResponseStatsPopulationResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);
export const isPopulationEnvelope = (value: unknown): value is PopulationEnvelope =>
  validate(value) && value.code === "STATS_POPULATION_SUCCESS";

const SERVER = /^[\p{L}\p{N}]{1,32}$/u;
/** The one filter this view takes: a server name, or none for every server. */
export function populationSearch(server?: string | null) {
  const search = new URLSearchParams();
  if (server && SERVER.test(server)) search.set("server", server);
  return search;
}

/** '2026년 10월 31일' for the 집계 기준 caption (the date is already KST). */
export function snapshotText(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return y && m && d ? `${y}년 ${m}월 ${d}일` : date;
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  503: ["STATS_UNAVAILABLE"],
};

export function requestPopulation(
  server: string | undefined,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<PopulationEnvelope>> {
  const url = backendUrl(origin, "/api/v1/stats/population");
  if (url) for (const [key, value] of populationSearch(server)) url.searchParams.set(key, value);
  return requestBackend(url, { ...options, isValid: isPopulationEnvelope, errorCodes });
}
