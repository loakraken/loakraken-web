// Gold figures shared by the growth tools. A value is rounded first and the
// sign comes from the rounded value, as the comparison calculators show it:
// .5 goes up (Math.round), so −1,087.5 → −1,087 and 1,087.5 → 1,088 (PM 총괄
// 2026-10-14). Rounding the absolute value instead turned −1,087.5 into −1,088.

/** Whole gold, .5 rounded up; never −0. */
export const roundGold = (value: number) => Math.round(value) || 0;

/** "1,088" */
export const goldText = (value: number) => roundGold(value).toLocaleString("ko-KR");

/** "+1,088" / "−1,087" / "+0" — the sign of the rounded value. */
export function signedGold(value: number) {
  const rounded = roundGold(value);
  return `${rounded >= 0 ? "+" : "−"}${Math.abs(rounded).toLocaleString("ko-KR")}`;
}
