import { krakenScoreView, type KrakenScore } from "@/lib/character/kraken-score";
import styles from "./character.module.css";

/**
 * 크라켄 점수 (backend #561) in a strip right under the banner: the score and
 * its tier, a bar for the way into the tier and the points to the next one.
 * Not inside the band: it has a fixed height, and one more line pushed the
 * rank badge or the facts out of it (1440). Not public yet (or a backend
 * without it): no strip. Not computed: '준비 중' in the same box, the bar and
 * its line kept, so a refresh that brings the score moves nothing (A7). Its
 * tier names are the players' (브론즈 … 에스더), unlike the rank badge's depth names.
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
      <span className={styles.krakenLabel}>크라켄 점수</span>
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
    </section>
  );
}
