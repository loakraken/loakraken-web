"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./not-found.module.css";

/**
 * The 404 mark with a pair of eyes that follow the pointer (#336). The idea —
 * eyes tracking the cursor on an error page — follows A Color Bright's 404 and
 * bencho.dev's Eye tracker block (MIT); this is our own implementation on our
 * logo. Pupils move by transform only, once per frame. Touch looks around a
 * few times and settles within 5 seconds; reduced motion keeps them still.
 */
export function NotFoundEyes({ children }: { children: ReactNode }) {
  const eyes = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = eyes.current;
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pupils = [...root.querySelectorAll<HTMLElement>("[data-pupil]")];
    const aim = (x: number, y: number) => {
      for (const pupil of pupils) {
        const box = pupil.parentElement!.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        const angle = Math.atan2(y - cy, x - cx);
        const reach = Math.min(box.width * 0.22, Math.hypot(x - cx, y - cy) / 6);
        pupil.style.transform = `translate(${Math.cos(angle) * reach}px, ${Math.sin(angle) * reach}px)`;
      }
    };

    if (matchMedia("(pointer: fine)").matches) {
      let frame = 0;
      const onMove = (event: PointerEvent) => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          aim(event.clientX, event.clientY);
          frame = 0;
        });
      };
      addEventListener("pointermove", onMove, { passive: true });
      return () => {
        removeEventListener("pointermove", onMove);
        cancelAnimationFrame(frame);
      };
    }

    // Touch: glance around, then look straight ahead (no endless motion).
    const box = root.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const glances: [number, number][] = [[-1, -0.6], [1, -0.4], [0.2, 1], [0, 0]];
    const timers = glances.map(([dx, dy], i) =>
      setTimeout(() => {
        // The last glance is straight ahead: pupils back to centre, not cross-eyed.
        if (!dx && !dy) for (const pupil of pupils) pupil.style.transform = "";
        else aim(cx + dx * 200, cy + dy * 200);
      }, 400 + i * 1300),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className={styles.stage} aria-hidden="true">
      {children}
      <div ref={eyes} className={styles.eyes}>
        <span className={styles.eye}>
          <i data-pupil className={styles.pupil} />
        </span>
        <span className={styles.eye}>
          <i data-pupil className={styles.pupil} />
        </span>
      </div>
    </div>
  );
}
