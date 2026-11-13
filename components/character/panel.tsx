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
   * A heavy panel that usually starts below the first screen: in the two-column
   * layout the browser skips its layout and paint until it nears the viewport
   * (content-visibility), holding this many px of height meanwhile (measured on
   * the reference mock at 1280; the real height is remembered once drawn). Not in
   * one column (#1590): a jump there lands right under an undrawn panel.
   */
  defer?: number;
}) {
  return (
    <section
      id={id}
      className={styles.panel}
      data-wide={wide || undefined}
      data-defer={defer ? "" : undefined}
      style={
        defer
          ? ({ "--defer-h": `${defer}px` } as CSSProperties)
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
