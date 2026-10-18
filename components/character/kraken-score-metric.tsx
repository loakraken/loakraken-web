import { HelpInfo } from "@/components/stats/basis-note";
import { KRAKEN_TIER_ORDER, krakenScoreView, type KrakenScore } from "@/lib/character/kraken-score";
import styles from "./character.module.css";

/**
 * 크라켄 점수 (backend #561) in a strip right under the banner: the score and
 * its tier, a bar for the way into the tier and the points to the next one.
 * Not inside the band: it has a fixed height, and one more line pushed the
 * rank badge or the facts out of it (1440). Not public yet (or a backend
 * without it): no strip. Not computed: '준비 중' in the same box with a short
 * reason where the bar's line was (no empty bar that reads as 0 points), so a
 * refresh that brings the score moves nothing (A7). Its tier names are the
 * players' (브론즈 … 에스더), unlike the rank badge's depth names. ⓘ says what
 * the score is (not the official combat power) and where the tiers start.
 */
export function KrakenScoreStrip({ score }: { score: KrakenScore | null }) {
  const view = krakenScoreView(score);
  if (view.state === "hidden") return null;
  const ready = view.state === "ready";
  return (
    <section
      className={styles.krakenScore}
      aria-label="크라켄 점수"
      data-pending={ready ? undefined : ""}
      data-tier={ready ? view.tierCode : undefined}
    >
      <span className={styles.krakenLabel}>
        크라켄 점수
        <HelpInfo label="크라켄 점수 안내" title="크라켄 점수">
          <p>LOAKraken이 공격력·아크 패시브·보석·팔찌 등으로 매긴 자체 점수예요. 게임의 공식 전투력과는 다른 값이에요.</p>
          <p>딜러와 서포터는 따로 계산해요. 티어는 낮은 순서로 {KRAKEN_TIER_ORDER.join("·")}예요.</p>
          <p>{ready ? view.bounds : view.reason.long}</p>
        </HelpInfo>
      </span>
      <span className={styles.krakenValue}>
        {ready ? view.score : "준비 중"}
        {ready && <span className={styles.krakenTier}>{view.tier}</span>}
      </span>
      <span className={styles.krakenProgress}>
        {ready && (
          <span className={styles.krakenTrack} aria-hidden="true">
            <span style={{ width: `${view.progress}%` }} />
          </span>
        )}
        <small className={styles.krakenNext}>
          {ready ? (view.next ?? "최고 티어") : view.reason.short}
          {ready && <span className={styles.srOnly}> ({view.tier} 티어 {view.progress}% 진행)</span>}
        </small>
      </span>
    </section>
  );
}
