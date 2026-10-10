"use client";

import { useEffect, useRef } from "react";
import styles from "./not-found.module.css";

/** A text caret that trails the pointer (precise pointers only), as on Anti
 * Average's 404. Transform only, once per frame; hidden on touch and with
 * reduced motion, and the real cursor is never hidden. */
export function NotFoundCaret() {
  const caret = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = caret.current;
    if (!el || !matchMedia("(pointer: fine)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        el.style.transform = `translate(${event.clientX + 12}px, ${event.clientY - 17}px)`;
        el.dataset.on = "";
        frame = 0;
      });
    };
    addEventListener("pointermove", onMove, { passive: true });
    return () => {
      removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
  return <span ref={caret} className={styles.caret} aria-hidden="true" />;
}
