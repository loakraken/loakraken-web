// 크라켄 점수 (backend #561): LOAKraken's own score and its tier, apart from
// the official combat power. The banner shows the score, the tier, how far
// into the tier the character is and the points left to the next one.
import type { components } from "../api/schema";
import { labelOf } from "../api/tolerant";

export type KrakenScore = components["schemas"]["KrakenScoreResponse"];

/** Tier names as players say them; an unknown code shows as unknown. */
export const KRAKEN_TIER_LABEL: Record<string, string> = {
  BRONZE: "브론즈",
  SILVER: "실버",
  GOLD: "골드",
  DIAMOND: "다이아",
  MASTER: "마스터",
  GRANDMASTER: "그랜드마스터",
  ESTHER: "에스더",
};

/** Why there is no score, for the visitor: a short line under '준비 중' and the whole sentence behind ⓘ. */
export type KrakenPendingReason = { short: string; long: string };

/**
 * Per reason code (backend 1팀's table, 10-18), with the page's own button
 * name '갱신'. A code this build does not know reads as the last one.
 */
const PENDING_REASONS: Record<string, KrakenPendingReason> = {
  INPUT_PENDING: {
    short: "갱신하면 계산돼요",
    long: "이전에 조회한 기록이라 점수를 아직 계산하지 않았어요. 갱신하면 계산돼요.",
  },
  ROLE_UNKNOWN: {
    short: "아크 패시브 정보가 없어요",
    long: "딜러·서포터를 판단할 아크 패시브 정보가 없어 점수를 계산하지 않았어요. 게임에서 아크 패시브를 설정한 뒤 갱신해 주세요.",
  },
  SCORE_UNAVAILABLE: {
    short: "무기·아크 패시브 정보가 부족해요",
    long: "무기나 아크 패시브 정보가 부족해 점수를 낼 수 없어요. 장비와 아크 패시브를 확인한 뒤 갱신해 주세요.",
  },
  CALC_FAILED: {
    short: "계산하지 못했어요",
    long: "점수를 계산하지 못했어요. 잠시 뒤 갱신해 주세요.",
  },
};
const UNKNOWN_REASON: KrakenPendingReason = {
  short: "지금은 보여 드릴 수 없어요",
  long: "지금은 점수를 보여 드릴 수 없어요. 잠시 뒤 갱신해 주세요.",
};

export type KrakenScoreView =
  /** Not sent (a backend before it) or not public yet: no block at all. */
  | { state: "hidden" }
  /** Sent but not computed, or a value the screen cannot trust: '준비 중' and why. */
  | { state: "pending"; reason: KrakenPendingReason }
  | {
      state: "ready";
      score: string;
      tier: string;
      tierCode: string;
      /** 0–100, the backend's floored percent within the tier. */
      progress: number;
      /** "마스터 티어까지 1,042점"; null at the top tier. */
      next: string | null;
      /** Where this tier and the next start: "다이아 티어는 5,000점부터, 마스터 티어는 6,700점부터예요." */
      bounds: string;
    };

/** The tiers from the lowest, as the ⓘ text lists them. */
export const KRAKEN_TIER_ORDER = ["BRONZE", "SILVER", "GOLD", "DIAMOND", "MASTER", "GRANDMASTER", "ESTHER"].map(
  (code) => KRAKEN_TIER_LABEL[code],
);

const two = (n: number) => n.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * What the banner shows. OK with a finite, non-negative score and a tier is
 * ready; UNSUPPORTED (any reason code, known or not) and anything odd is
 * pending, never a blank or a made-up number.
 */
export function krakenScoreView(value: KrakenScore | null | undefined): KrakenScoreView {
  if (!value || value.status === "DISABLED") return { state: "hidden" };
  const { score, tier } = value;
  if (value.status !== "OK" || score == null || !Number.isFinite(score) || score < 0 || !tier)
    return {
      state: "pending",
      reason: (value.status === "UNSUPPORTED" && value.reasonCode && PENDING_REASONS[value.reasonCode]) || UNKNOWN_REASON,
    };
  const progress = Number.isFinite(tier.progressPercent) ? Math.min(100, Math.max(0, Math.floor(tier.progressPercent))) : 0;
  const nextName = tier.nextCode ? labelOf(KRAKEN_TIER_LABEL, tier.nextCode) : null;
  // Whole points, rounded as comparison B does (every recorded sample matches
  // only that; PM-프론트 #907). The backend's value is already rounded to two
  // decimals, so a whole-number field from it will replace this when it comes.
  const left = tier.remaining != null && Number.isFinite(tier.remaining) && tier.remaining >= 0 ? Math.round(tier.remaining) : null;
  const tierName = labelOf(KRAKEN_TIER_LABEL, tier.code);
  const whole = (n: number) => Math.round(n).toLocaleString("ko-KR");
  const from = Number.isFinite(tier.min) ? `${tierName} 티어는 ${whole(tier.min)}점부터` : null;
  const nextFrom = nextName && tier.nextMin != null && Number.isFinite(tier.nextMin) ? `${nextName} 티어는 ${whole(tier.nextMin)}점부터` : null;
  return {
    state: "ready",
    score: two(score),
    tier: tierName,
    tierCode: tier.code,
    progress: nextName ? progress : 100,
    next: nextName && left != null ? `${nextName} 티어까지 ${left.toLocaleString("ko-KR")}점` : null,
    bounds: !nextName
      ? from
        ? `${from}예요. 가장 높은 티어예요.`
        : `${tierName}는 가장 높은 티어예요.`
      : from || nextFrom
        ? `${[from, nextFrom].filter(Boolean).join(", ")}예요.`
        : "",
  };
}
