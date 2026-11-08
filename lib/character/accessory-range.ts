import type { components } from "@/lib/api/schema";

/** Where an accessory's 힘·민첩·지능 sits in its slot and polish stage range (official item dictionary). */
export type AccessoryStats = components["schemas"]["AccessoryStatsResponse"];

const num = (n: number) => n.toLocaleString("ko-KR");

/**
 * The range % as it is shown ("31.02%", two decimals like the market search), or null when there is
 * nothing to show: no stats (another slot, an older tier, an api before #6) or a value outside the
 * range (the backend leaves the % out then, and so do we, rather than a number past 100).
 */
export function rangePercent(stats: AccessoryStats | null | undefined): string | null {
  return stats?.mainStatRangePct == null ? null : `${stats.mainStatRangePct.toFixed(2)}%`;
}

/** The numbers behind the %: "16,009 (범위 15,178 ~ 17,857, 31.02%)", for the tooltip and screen readers. */
export function rangeDetail(stats: AccessoryStats | null | undefined): string | null {
  const pct = rangePercent(stats);
  if (!stats || !pct) return null;
  return `${num(stats.mainStat)} (범위 ${num(stats.mainStatMin)} ~ ${num(stats.mainStatMax)}, ${pct})`;
}
