// 보석 레벨 분포 (stats B2, api #782): each character's 4-tier gem average in
// 12 fixed bins ('5 미만', 5.0~9.5 by 0.5, 10.0), over the same sample and
// filters as the other statistics. The bins sum to gemSample — characters
// whose gems were seen — which can be smaller than the sample itself.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/stats-gem-levels.openapi.json";
import type { components } from "../api/stats-gem-levels-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { bestCombatPowerSearch } from "./best-combat-power";
import type { StatsQuery } from "./model";

type Schemas = components["schemas"];
export type GemLevelsEnvelope = Schemas["ApiResponseStatsGemLevelsResponse"];
export type GemLevels = Schemas["StatsGemLevelsResponse"];
export type GemLevelBin = Schemas["StatsGemLevelBinResponse"];

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<GemLevelsEnvelope>({
    $ref: "#/components/schemas/ApiResponseStatsGemLevelsResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);
export const isGemLevelsEnvelope = (value: unknown): value is GemLevelsEnvelope =>
  validate(value) && value.code === "STATS_GEM_LEVELS_SUCCESS";

/** The stats screen's filters, as for best combat power (no distribution options). */
export const gemLevelsSearch = bestCombatPowerSearch;

/** A bin's name: '5 미만', '5.0', … '10.0'. */
export function gemBinLabel(bin: Pick<GemLevelBin, "from" | "to">) {
  if (bin.from == null) return `${bin.to ?? 5} 미만`;
  if (bin.to == null) return bin.from.toFixed(1);
  return bin.from.toFixed(1);
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE"],
  503: ["STATS_UNAVAILABLE"],
};

export function requestGemLevels(
  query: StatsQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<GemLevelsEnvelope>> {
  const url = backendUrl(origin, "/api/v1/stats/gem-levels");
  if (url) for (const [key, value] of gemLevelsSearch(query)) url.searchParams.set(key, value);
  return requestBackend(url, { ...options, isValid: isGemLevelsEnvelope, errorCodes });
}
