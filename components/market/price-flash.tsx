"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./market.module.css";

/**
 * A market price that briefly tints when a refresh changes it (motion guide 7,
 * item 9): the cell's background fades out within 0.6s, red for up and blue
 * for down, at 12% so repeated refreshes stay quiet. Nothing plays on the
 * first load, for a new row or for an unchanged value; reduced motion skips it.
 */
export function PriceFlash({ value, children }: { value: number | null; children: ReactNode }) {
  const node = useRef<HTMLElement>(null);
  const previous = useRef(value);
  useEffect(() => {
    const before = previous.current;
    previous.current = value;
    const el = node.current;
    if (!el || before == null || value == null || before === value) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.dataset.flash = value > before ? "up" : "down";
    el.animate({ opacity: [1, 0] }, { duration: 600, easing: "ease-out", pseudoElement: "::after" });
  }, [value]);
  return (
    <b ref={node} className={styles.flash}>
      {children}
    </b>
  );
}
