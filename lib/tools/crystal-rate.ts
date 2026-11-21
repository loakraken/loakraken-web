// The in-game crystal exchange rate the user types (gold per 100 blue crystals), shared by the 로아샵 효율 계산기
// and the 시세 screen's 블루 크리스탈 card (X6). There is no official feed of that rate, so it is only ever the
// user's own value; the official figure is the shop's royal crystals per 100 blue crystals (lib/tools/data/loa-shop.json).
// No data import here: the 시세 screen takes this without the shop's package data.

/** The typed rate as gold per 100 blue crystals, or null when empty, zero or not a whole number. */
export function parseRate(value: string): number | null {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  const rate = Number(digits);
  return Number.isSafeInteger(rate) && rate > 0 ? rate : null;
}

/** Gold for one royal crystal through the official path: royal → blue crystals (shop) → gold (in-game exchange). */
export const goldPerRoyal = (goldPer100: number, royalPer100: number) => goldPer100 / royalPer100;
