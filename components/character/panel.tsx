import type { ReactNode } from "react";
import styles from "./detail.module.css";
import { FpEnd } from "@/components/ui/fp-end";

/** Flat titled panel used by every character tab. */
export function Panel({
  title,
  meta,
  children,
  id,
  wide,
  action,
  dense,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  id?: string;
  wide?: boolean;
  /** A control at the head's end, after the meta (e.g. fold the panel). */
  action?: ReactNode;
  /**
   * Less room over a list on phones (the roster's server lists). Said on the panel itself, not read
   * from its list with :has(): the list arrives after the head, and the head moved up 8 px then.
   */
  dense?: boolean;
}) {
  return (
    <section
      id={id}
      className={styles.panel}
      data-wide={wide || undefined}
      data-dense={dense || undefined}
      aria-label={title}
    >
      {/* Drawn once whole (A7 character sweep 2): the meta beside the title made the head taller when it came. */}
      <header className={styles.panelHead} data-fp-whole="">
        <h2>{title}</h2>
        {meta && <span className={styles.panelMeta}>{meta}</span>}
        {action}
        <FpEnd />
      </header>
      {children}
    </section>
  );
}
