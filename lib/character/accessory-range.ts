import type { components } from "@/lib/api/schema";

/** Where an accessory's 힘·민첩·지능 sits against its slot's 연마 3단계 range (official item dictionary). */
export type AccessoryStats = components["schemas"]["AccessoryStatsResponse"];

/** What the range is measured against (the same 연마 3단계 range for every accessory of a slot). */
export const RANGE_BASIS = "연마 3단계 범위 기준";

const num = (n: number) => n.toLocaleString("ko-KR");

/**
 * The range % as it is shown, signed and never clamped: "31.02%", "103.20%", "−12.40%" (a true minus
 * sign, two decimals like the market search). An accessory with fewer polish lines can sit below the
 * 연마 3단계 range (negative) and a lucky roll above it (past 100). Null when there is nothing to show:
 * no stats (another slot, an older tier, an api before #6) or no % from the backend.
 */
export function rangePercent(stats: AccessoryStats | null | undefined): string | null {
  const pct = stats?.mainStatRangePct;
  if (pct == null) return null;
  const text = Math.abs(pct).toFixed(2);
  // -0.004 rounds to "0.00": no sign on a zero.
  return `${pct < 0 && text !== "0.00" ? "−" : ""}${text}%`;
}

/** Below the 연마 3단계 range: the badge goes muted. */
export const belowRange = (stats: AccessoryStats | null | undefined) =>
  rangePercent(stats)?.startsWith("−") ?? false;

/** The numbers behind the %: "16,009 (연마 3단계 범위 15,178 ~ 17,857, 31.02%)", for the tooltip and screen readers. */
export function rangeDetail(stats: AccessoryStats | null | undefined): string | null {
  const pct = rangePercent(stats);
  if (!stats || !pct) return null;
  return `${num(stats.mainStat)} (연마 3단계 범위 ${num(stats.mainStatMin)} ~ ${num(stats.mainStatMax)}, ${pct})`;
}
