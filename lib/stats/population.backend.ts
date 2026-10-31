// Backend side of population.ts: response validation (Ajv + the contract) and the
// request that uses it. Server code and tests only — the client imports
// population.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/stats-population.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { populationSearch, type PopulationEnvelope } from "./population";

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<PopulationEnvelope>({
    $ref: "#/components/schemas/ApiResponseStatsPopulationResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);

export const isPopulationEnvelope = (value: unknown): value is PopulationEnvelope =>
  validate(value) && value.code === "STATS_POPULATION_SUCCESS";

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
