// Backend side of level-combat-power.ts: response validation (Ajv + the contract) and
// the request that uses it. Server code and tests only — the client imports
// level-combat-power.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/stats-level-combat-power.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { levelCombatPowerSearch, type LevelCombatPowerEnvelope } from "./level-combat-power";
import type { StatsQuery } from "./model";

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<LevelCombatPowerEnvelope>({
    $ref: "#/components/schemas/ApiResponseStatsLevelCombatPowerResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);

export const isLevelCombatPowerEnvelope = (value: unknown): value is LevelCombatPowerEnvelope =>
  validate(value) && value.code === "STATS_LEVEL_COMBAT_POWER_SUCCESS";

const errorCodes: Record<number, readonly string[]> = {
  // 404: the api has no such endpoint yet (before it ships) - the screen leaves the chart out.
  404: ["NOT_FOUND"],
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE"],
  503: ["STATS_UNAVAILABLE"],
};

export function requestLevelCombatPower(
  query: StatsQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<LevelCombatPowerEnvelope>> {
  const url = backendUrl(origin, "/api/v1/stats/level-combat-power");
  if (url) for (const [key, value] of levelCombatPowerSearch(query)) url.searchParams.set(key, value);
  return requestBackend(url, { ...options, isValid: isLevelCombatPowerEnvelope, errorCodes });
}
