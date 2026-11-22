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
      /** 보스 피해 환산 Lv (X2): the total × 12, "60.24". */
      bossLevel: string;
      series: { label: string; percent: string }[];
      lines: { name: string; level: number | null; percent: string | null }[];
    };

/**
 * 보스 피해 환산 Lv (X2, PM 총괄 11-22 13:47; 계산 검증 13:46): our own reading of the ark grid efficiency, the total
 * gem real efficiency (options + core points, api #520) as 보스 피해 levels, one level counted as 1/12 %. Our number
 * from our verified model, not claimed equal to any other site's.
 */
export const BOSS_LEVELS_PER_PERCENT = 12;
export const bossLevel = (percent: number) =>
  (Math.round(percent * BOSS_LEVELS_PER_PERCENT * 100) / 100).toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
/** What the level is, in our words (the tooltip and its accessible name). */
export const BOSS_LEVEL_NOTE =
  "아크 그리드 효율을 젬 옵션 ‘보스 피해’ 레벨로 바꿔 나타낸 값이에요. 보스 피해 1레벨을 1/12%로 보고 효율에 12를 곱해 셈해요.";

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
    bossLevel: bossLevel(real.percent),
    series: real.series.filter((s) => finite(s.percent)).map((s) => ({ label: s.series, percent: realPercent(s.percent!) })),
    lines: real.options.map((o) => ({ name: o.name, level: o.level, percent: finite(o.percent) ? realPercent(o.percent) : null })),
  };
}

export type BraceletRealView =
  | { state: "hidden" }
  /** A supporter: the bracelet shows its grades only, no % (PM-프론트). */
  | { state: "grades" }
  | { state: "pending" }
  /**
   * The bracelet could not be read (api #706: an option the engine does not
   * know). Not 'coming soon' but 'not worked out, and why' (PM-프론트 P3).
   */
  | { state: "unavailable" }
  | { state: "ready"; percent: string; devil: string | null };

/**
 * Two decimals for both roles (the dealer's value is already cut, the
 * supporter's is sent whole). The 악마 피해 value only for a dealer; with the
 * setting on and no such value the plain one stays.
 */
export function braceletRealView(real: BraceletReal | null | undefined): BraceletRealView {
  if (!real) return { state: "hidden" };
  if (real.role === "SUPPORT") return { state: "grades" };
  // UNAVAILABLE comes with api #706, before the contract lists it: read as a string.
  if ((real.status as string) === "UNAVAILABLE") return { state: "unavailable" };
  if (real.status !== "OK" || !finite(real.percent)) return { state: "pending" };
  return {
    state: "ready",
    percent: realPercent(real.percent),
    devil: finite(real.devilDamagePercent) ? realPercent(real.devilDamagePercent) : null,
  };
}
