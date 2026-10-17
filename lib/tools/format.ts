// Gold figures shared by the growth tools, rounded the way each tool's
// comparison basis shows them (PM 총괄 2026-10-14):
//   "halfUp" (default) — Math.round, the sign from the rounded value:
//     −1,087.5 → −1,087, 1,087.5 → 1,088; zero shows "0" without a sign.
//     아비도스 제작 손익·생명의 기운 효율·더보기 손익.
//   "awayFromZero" — the absolute value rounded half away from zero, the sign
//     from the value itself: −1,087.5 → −1,088. 로아샵 효율, whose only
//     comparison basis rounds this way.
// In both, a value that rounds to 0 shows "0" without a sign (PM 총괄: also
// for 로아샵, where the basis would show −0.3 as "−0").

export type GoldRounding = "halfUp" | "awayFromZero";

/** Whole gold under the given rounding; never −0. */
export function roundGold(value: number, rounding: GoldRounding = "halfUp") {
  if (rounding === "awayFromZero") return Math.sign(value) * Math.round(Math.abs(value)) || 0;
  return Math.round(value) || 0;
}

/** "1,088" */
export const goldText = (value: number, rounding: GoldRounding = "halfUp") =>
  roundGold(value, rounding).toLocaleString("ko-KR");

/** "+1,088" / "−1,087" / "0". */
export function signedGold(value: number, rounding: GoldRounding = "halfUp") {
  if (rounding === "awayFromZero") {
    const size = Math.round(Math.abs(value));
    if (size === 0) return "0";
    return `${value > 0 ? "+" : "−"}${size.toLocaleString("ko-KR")}`;
  }
  const rounded = roundGold(value);
  if (rounded === 0) return "0";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toLocaleString("ko-KR")}`;
}
