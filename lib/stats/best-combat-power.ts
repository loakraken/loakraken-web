// Best combat power (backend #477·#480, checklist L5): for each character the
// highest combat power seen over its whole history (the ranking's
// bestCombatPower), counted overall and per class over the same sample and
// filters as the other statistics. A cell under 30 gives its count only. The
// combat power range filter applies to the current combat power, not the best.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/best-combat-power.openapi.json";
import type { components } from "../api/best-combat-power-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { statsSearch, type StatsQuery } from "./model";

type Schemas = components["schemas"];
export type BestCombatPowerEnvelope = Schemas["ApiResponseStatsBestCombatPowerResponse"];
export type BestCombatPower = Schemas["StatsBestCombatPowerResponse"];
export type BestRow = Schemas["StatsBestCombatPowerRowResponse"];

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<BestCombatPowerEnvelope>({
    $ref: "#/components/schemas/ApiResponseStatsBestCombatPowerResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);
export const isBestCombatPowerEnvelope = (value: unknown): value is BestCombatPowerEnvelope =>
  validate(value) && value.code === "STATS_BEST_COMBAT_POWER_SUCCESS";

/** The stats screen's filters, without the distribution's own (metric, width, percentile). */
export const bestCombatPowerSearch = (query: StatsQuery) =>
  statsSearch({ ...query, metric: undefined, width: undefined, percentileOf: undefined });

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE", "STATS_TOO_MANY_BINS"],
  503: ["STATS_UNAVAILABLE"],
};

export function requestBestCombatPower(
  query: StatsQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<BestCombatPowerEnvelope>> {
  const url = backendUrl(origin, "/api/v1/stats/best-combat-power");
  if (url) for (const [key, value] of bestCombatPowerSearch(query)) url.searchParams.set(key, value);
  return requestBackend(url, { ...options, isValid: isBestCombatPowerEnvelope, errorCodes });
}
