// Accessory cells and their days on record (user 11-16). A day is saved when someone opens the cell; the
// hourly accessory warmup (api #985) also saves the default filter's cells (고대 · 딜러 · 품질 70) once it
// is on in production. So a gap in an accessory chart means nobody opened that cell that day, unless it is
// a warmed cell after the warmup start.
import { daySlots, gapsBefore } from "./chart-gaps";
import type { AccessoryFilter } from "./auction-accessories";

// The first day (KST, YYYY-MM-DD) the accessory warmup saved prices in production; null until the switch
// is on there. Source: the production deploy record of the day the accessory warmup switch was turned on
// (v0.3.14 deploy, 2026-11-20 KST; checked 2026-11-20).
export const ACCESSORY_WARMUP_SINCE: string | null = "2026-11-20";

/** The filter the warmup keeps (the board's defaults). */
export const isWarmedFilter = (filter: AccessoryFilter) =>
  filter.grade === "ANCIENT" && filter.role === "DEALER" && filter.minQuality === 70;

const day = (date: string) => {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
};

/**
 * The note under an accessory chart, from its readings' days (UTC midnights, oldest first): null when no
 * day is missing, or when every missing day is after the warmup start of a warmed cell.
 */
export function accessoryGapNote(
  filter: AccessoryFilter,
  times: readonly number[],
  since: string | null = ACCESSORY_WARMUP_SINCE,
): string | null {
  if (!daySlots(times).some((slot) => slot.reading == null)) return null;
  if (!isWarmedFilter(filter) || since == null) return "이 칸은 누가 조회한 날만 기록돼요";
  return gapsBefore(times, since) ? `이 칸은 ${day(since)} 전에는 누가 조회한 날만 기록돼요` : null;
}
