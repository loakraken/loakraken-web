import type { ReactNode } from "react";
import styles from "./detail.module.css";

/** Flat titled panel used by every character tab. */
export function Panel({
  title,
  meta,
  children,
  id,
  wide,
  action,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  id?: string;
  wide?: boolean;
  /** A control at the head's end, after the meta (e.g. fold the panel). */
  action?: ReactNode;
}) {
  return (
    <section
      id={id}
      className={styles.panel}
      data-wide={wide || undefined}
      aria-label={title}
    >
      <header className={styles.panelHead}>
        <h2>{title}</h2>
        {meta && <span className={styles.panelMeta}>{meta}</span>}
        {action}
      </header>
      {children}
    </section>
  );
}
