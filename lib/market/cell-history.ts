// Auction cell history (api #920): one gem or accessory board cell's lowest
// buy-now price by day, as LOAKraken last saw it that day (not an official
// average); a day nobody opened the cell has no row. Client-safe: types,
// ranges and the chart points; validation lives in the *.backend.ts files.
import type { components } from "../api/auction-gems-schema";

export type CellHistory = components["schemas"]["AuctionCellHistoryResponse"];
export type CellDay = components["schemas"]["AuctionCellDayResponse"];
export type CellHistoryEnvelope = { code: string; message: string; data: CellHistory };

/** Auction cells have no minute prices: 7일 · 30일 · 3개월 · 1년, opening on 30일. */
export type CellRange = 7 | 30 | 90 | 365;
export const CELL_RANGES: readonly CellRange[] = [7, 30, 90, 365];
export const CELL_RANGE_LABEL: Record<CellRange, string> = { 7: "7일", 30: "30일", 90: "3개월", 365: "1년" };
export const cellRangeParam = (range: CellRange) => `${range}d` as "7d" | "30d" | "90d" | "365d";
const RANGE_PARAMS = new Set(["7d", "14d", "30d", "90d", "365d"]);
/** A range from an address, or null when it is not one the api takes. */
export const parseCellRange = (value: string | null) => (value != null && RANGE_PARAMS.has(value) ? value : null);

/** Completed days, oldest first (today's partial reading is left out of the line). */
export function completedCellDays(history: CellHistory | undefined) {
  return (history?.days ?? []).filter((day) => !day.partial).slice().reverse();
}

/** Fewer completed days than the range holds (a full range has range − 1 besides today). */
export function shortOf(days: readonly CellDay[], range: CellRange): number | null {
  return range > 7 && days.length < range - 1 ? days.length : null;
}
