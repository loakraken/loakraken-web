import type { CSSProperties, ReactNode } from "react";
import styles from "./detail.module.css";

/** Flat titled panel used by every character tab. */
export function Panel({
  title,
  meta,
  children,
  id,
  wide,
  action,
  defer,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  id?: string;
  wide?: boolean;
  /** A control at the head's end, after the meta (e.g. fold the panel). */
  action?: ReactNode;
  /**
   * A heavy panel that usually starts below the first screen: the browser
   * skips its layout and paint until it nears the viewport (content-visibility),
   * holding [one column, two columns] px of height meanwhile (measured on the
   * reference mock; the real height is remembered once drawn). /character at
   * 360 laid out all ~1,900 nodes in one 170–235 ms task (TBT P2, 11-13).
   */
  defer?: readonly [number, number];
}) {
  return (
    <section
      id={id}
      className={styles.panel}
      data-wide={wide || undefined}
      data-defer={defer ? "" : undefined}
      style={
        defer
          ? ({ "--defer-h": `${defer[0]}px`, "--defer-h-wide": `${defer[1]}px` } as CSSProperties)
          : undefined
      }
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
