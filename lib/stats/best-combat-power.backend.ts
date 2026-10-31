// Backend side of best-combat-power.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// best-combat-power.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/best-combat-power.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { type StatsQuery } from "./model";
import { bestCombatPowerSearch, type BestCombatPowerEnvelope } from "./best-combat-power";

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<BestCombatPowerEnvelope>({
    $ref: "#/components/schemas/ApiResponseStatsBestCombatPowerResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);

export const isBestCombatPowerEnvelope = (value: unknown): value is BestCombatPowerEnvelope =>
  validate(value) && value.code === "STATS_BEST_COMBAT_POWER_SUCCESS";

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
