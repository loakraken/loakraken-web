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

export type KrakenScoreView =
  /** Not sent (a backend before it) or not public yet: no block at all. */
  | { state: "hidden" }
  /** Sent but not computed, or a value the screen cannot trust: '준비 중'. */
  | { state: "pending" }
  | {
      state: "ready";
      score: string;
      tier: string;
      tierCode: string;
      /** 0–100, the backend's floored percent within the tier. */
      progress: number;
      /** "마스터 티어까지 1,042점"; null at the top tier. */
      next: string | null;
    };

const two = (n: number) => n.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * What the banner shows. OK with a finite, non-negative score and a tier is
 * ready; UNSUPPORTED (any reason code, known or not) and anything odd is
 * pending, never a blank or a made-up number.
 */
export function krakenScoreView(value: KrakenScore | null | undefined): KrakenScoreView {
  if (!value || value.status === "DISABLED") return { state: "hidden" };
  const { score, tier } = value;
  if (value.status !== "OK" || score == null || !Number.isFinite(score) || score < 0 || !tier) return { state: "pending" };
  const progress = Number.isFinite(tier.progressPercent) ? Math.min(100, Math.max(0, Math.floor(tier.progressPercent))) : 0;
  const nextName = tier.nextCode ? labelOf(KRAKEN_TIER_LABEL, tier.nextCode) : null;
  // Whole points, rounded up: 0.4 left is still a point to go, never "0점".
  const left = tier.remaining != null && Number.isFinite(tier.remaining) && tier.remaining > 0 ? Math.ceil(tier.remaining) : null;
  return {
    state: "ready",
    score: two(score),
    tier: labelOf(KRAKEN_TIER_LABEL, tier.code),
    tierCode: tier.code,
    progress: nextName ? progress : 100,
    next: nextName && left != null ? `${nextName} 티어까지 ${left.toLocaleString("ko-KR")}점` : null,
  };
}
