// The in-game crystal exchange rate the user types (gold per 100 blue crystals), shared by the 로아샵 효율 계산기
// and the 시세 screen's 블루 크리스탈 card (X6). There is no official feed of that rate, so it is only ever the
// user's own value; the official figure is the shop's royal crystals per 100 blue crystals (lib/tools/data/loa-shop.json).
// No data import here: the 시세 screen takes this without the shop's package data.

/** A whole number of gold: digits, or digits with commas every three places ('27300', '27,300'). */
const WHOLE = /^(?:\d+|\d{1,3}(?:,\d{3})+)$/;

/**
 * The typed rate: empty (nothing typed), a rate (a positive whole number), or invalid. Nothing is stripped
 * silently (codex P2 on #1889): '-27300' (a sign), '1.5' (a decimal point), '2,73,00' (commas out of place), 0 and a
 * number past the safe range are invalid, never read as some other number. Spaces around it are ignored.
 */
export function checkRate(value: string): { rate: number | null; invalid: boolean } {
  const text = value.trim();
  if (!text) return { rate: null, invalid: false };
  if (!WHOLE.test(text)) return { rate: null, invalid: true };
  const rate = Number(text.replace(/,/g, ""));
  return Number.isSafeInteger(rate) && rate > 0 ? { rate, invalid: false } : { rate: null, invalid: true };
}

/** The typed rate as gold per 100 blue crystals, or null when empty or invalid. */
export const parseRate = (value: string): number | null => checkRate(value).rate;

/** What the field says under an invalid rate (both pages). */
// One line at 320, so it fits the shop tool's fixed error slot.
export const RATE_INVALID = "1 이상의 정수로 넣어 주세요.";

/** Gold for one royal crystal through the official path: royal → blue crystals (shop) → gold (in-game exchange). */
export const goldPerRoyal = (goldPer100: number, royalPer100: number) => goldPer100 / royalPer100;
