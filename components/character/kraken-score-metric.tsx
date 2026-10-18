import { krakenScoreView, type KrakenScore } from "@/lib/character/kraken-score";
import styles from "./character.module.css";

/**
 * 크라켄 점수 (backend #561) as a row of the banner facts: the score and its
 * tier, then a bar for the way into the tier and the points to the next one.
 * In the facts, not the figures row: the band has a fixed height and a taller
 * figures row pushed the rank badge out of it. Not public yet (or a backend
 * without it): no row. Not computed: '준비 중' in the same two lines, so a
 * refresh that brings the score moves nothing (A7). Its tier names are the
 * players' (브론즈 … 에스더), unlike the rank badge's depth names.
 */
export function KrakenScoreFact({ score }: { score: KrakenScore | null }) {
  const view = krakenScoreView(score);
  if (view.state === "hidden") return null;
  const ready = view.state === "ready";
  return (
    <>
      <dt>크라켄 점수</dt>
      <dd className={styles.krakenScore} data-pending={ready ? undefined : ""} data-tier={ready ? view.tierCode : undefined}>
        <span className={styles.krakenValue}>
          {ready ? view.score : "준비 중"}
          {ready && <span className={styles.krakenTier}>{view.tier}</span>}
        </span>
        <span className={styles.krakenProgress}>
          <span className={styles.krakenTrack} aria-hidden="true">
            <span style={{ width: `${ready ? view.progress : 0}%` }} />
          </span>
          <small className={styles.krakenNext}>
            {ready ? (view.next ?? "최고 티어") : " "}
            {ready && <span className={styles.srOnly}> ({view.tier} 티어 {view.progress}% 진행)</span>}
          </small>
        </span>
      </dd>
    </>
  );
}
