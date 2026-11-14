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
