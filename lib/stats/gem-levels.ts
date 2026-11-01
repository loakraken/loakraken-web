// 보석 레벨 분포 (stats B2, api #782): each character's 4-tier gem average in
// 12 fixed bins ('5 미만', 5.0~9.5 by 0.5, 10.0), over the same sample and
// filters as the other statistics. The bins sum to gemSample — characters
// whose gems were seen — which can be smaller than the sample itself.
// Validation and the request live in gem-levels.backend.ts (server only).
import type { components } from "../api/stats-gem-levels-schema";
import { bestCombatPowerSearch } from "./best-combat-power";

type Schemas = components["schemas"];
export type GemLevelsEnvelope = Schemas["ApiResponseStatsGemLevelsResponse"];
export type GemLevels = Schemas["StatsGemLevelsResponse"];
export type GemLevelBin = Schemas["StatsGemLevelBinResponse"];

/** The stats screen's filters, as for best combat power (no distribution options). */
export const gemLevelsSearch = bestCombatPowerSearch;

/** A bin's name: '5 미만', '5.0', … '10.0'. */
export function gemBinLabel(bin: Pick<GemLevelBin, "from" | "to">) {
  if (bin.from == null) return `${bin.to ?? 5} 미만`;
  if (bin.to == null) return bin.from.toFixed(1);
  return bin.from.toFixed(1);
}
