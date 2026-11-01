import { whole } from "@/lib/stats/model";
import styles from "./rank-podium.module.css";

/** The mark is out of flow; all table cells keep their original dimensions. */
export function RankNumber({ rank }: { rank: number | null | undefined }) {
  const top = rank === 1 || rank === 2 || rank === 3 ? rank : undefined;
  return <span className={styles.rank} data-top-rank={top}>{whole(rank)}</span>;
}
