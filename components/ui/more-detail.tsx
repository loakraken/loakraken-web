// '자세히' for long screen notes (#1112): the one line that matters stays on
// the page, the rest folds here, closed by default. A native details/summary,
// so it opens with Enter or Space and needs no script; the same word on every
// screen. Calc-basis and source notes are folded, never removed.
import type { ReactNode } from "react";
import styles from "./more-detail.module.css";

export function MoreDetail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <details className={className ? `${styles.more} ${className}` : styles.more}>
      <summary>자세히</summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}
