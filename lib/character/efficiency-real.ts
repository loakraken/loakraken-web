// Real efficiency (backend #570·#571, user decision: 효율 = the comparison
// sites' damage share): how much the ark grid gems and the bracelet add, by the
// score engine's own formula. Replaces the combat-power contribution shown before.
import type { Character } from "./model";

type ArkGridReal = NonNullable<NonNullable<Character["arkGridEfficiency"]>["real"]>;
type BraceletReal = NonNullable<NonNullable<Character["braceletEfficiency"]>["real"]>;

/** "+4.67%": two decimals as sent (the backend has already cut them). */
export const realPercent = (value: number) =>
  `+${value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const finite = (value: number | null | undefined): value is number => value != null && Number.isFinite(value);

export type ArkGridRealView =
  /** Not sent (a backend before it): nothing drawn. */
  | { state: "hidden" }
  /** No ark grid on the character: its gems add nothing (PM-프론트 P3). */
  | { state: "none" }
  /** A grid, but not worked out (any reason code, known or not). */
  | { state: "pending" }
  | {
      state: "ready";
      total: string;
      /** "젬 옵션 +3.21% · 코어 포인트 +1.41%", whichever is known. */
      parts: string | null;
      series: { label: string; percent: string }[];
      lines: { name: string; level: number | null; percent: string | null }[];
    };

export function arkGridRealView(real: ArkGridReal | null | undefined, hasGrid: boolean): ArkGridRealView {
  if (!real) return { state: "hidden" };
  if (real.status !== "OK" || !finite(real.percent)) return hasGrid ? { state: "pending" } : { state: "none" };
  const parts = [
    finite(real.optionsPercent) ? `젬 옵션 ${realPercent(real.optionsPercent)}` : null,
    finite(real.pointsPercent) ? `코어 포인트 ${realPercent(real.pointsPercent)}` : null,
  ].filter(Boolean);
  return {
    state: "ready",
    total: realPercent(real.percent),
    parts: parts.length ? parts.join(" · ") : null,
    series: real.series.filter((s) => finite(s.percent)).map((s) => ({ label: s.series, percent: realPercent(s.percent!) })),
    lines: real.options.map((o) => ({ name: o.name, level: o.level, percent: finite(o.percent) ? realPercent(o.percent) : null })),
  };
}

export type BraceletRealView =
  | { state: "hidden" }
  /** A supporter: the bracelet shows its grades only, no % (PM-프론트). */
  | { state: "grades" }
  | { state: "pending" }
  | { state: "ready"; percent: string; devil: string | null };

/**
 * Two decimals for both roles (the dealer's value is already cut, the
 * supporter's is sent whole). The 악마 피해 value only for a dealer; with the
 * setting on and no such value the plain one stays.
 */
export function braceletRealView(real: BraceletReal | null | undefined): BraceletRealView {
  if (!real) return { state: "hidden" };
  if (real.role === "SUPPORT") return { state: "grades" };
  if (real.status !== "OK" || !finite(real.percent)) return { state: "pending" };
  return {
    state: "ready",
    percent: realPercent(real.percent),
    devil: finite(real.devilDamagePercent) ? realPercent(real.devilDamagePercent) : null,
  };
}
