"use client";

import { useEffect, useRef, useState } from "react";
import { classChip, classIconUrl } from "@/lib/stats/class-icons";
import styles from "./class-icon.module.css";

// One observer for every icon on the page: a row's icon is asked for only
// when the row comes within a short reach of the screen.
const waiting = new Map<Element, () => void>();
let observer: IntersectionObserver | null = null;

function whenNear(el: Element, show: () => void) {
  if (typeof IntersectionObserver === "undefined") {
    show();
    return;
  }
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer?.unobserve(entry.target);
        waiting.get(entry.target)?.();
        waiting.delete(entry.target);
      }
    },
    { rootMargin: "100px 0px" },
  );
  waiting.set(el, show);
  observer.observe(el);
  return () => {
    waiting.delete(el);
    observer?.unobserve(el);
  };
}

const savesData = () =>
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

/**
 * The class's official icon in a fixed box (no layout shift). The official
 * files are 3–20 KB each and uncompressed, and a whole stats table sits inside
 * the browser's own lazy-loading reach (25 icons, about 230 KB, on the first
 * visit), so the image is asked for only when its row is on screen, and never
 * under Data Saver. The files are black, so dark themes invert them.
 * Decorative: the class name is always written next to it. A class without a
 * known icon, an icon that fails, or Data Saver shows its first two letters.
 */
export function ClassIcon({ name, size = 24 }: { name: string; size?: number }) {
  const url = classIconUrl(name);
  const [state, setState] = useState<"wait" | "show" | "chip">(url ? "wait" : "chip");
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (state !== "wait" || !box.current) return;
    return whenNear(box.current, () => setState(savesData() ? "chip" : "show"));
  }, [state]);
  return (
    <span
      ref={box}
      className={styles.box}
      style={{ width: size, height: size }}
      data-chip={state === "chip" || undefined}
      aria-hidden="true"
    >
      {state === "show" && url ? (
        // eslint-disable-next-line @next/next/no-img-element -- official CDN icon, hotlinked at a fixed size
        <img
          className={styles.icon}
          src={url}
          alt=""
          width={size}
          height={size}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setState("chip")}
        />
      ) : state === "chip" ? (
        classChip(name)
      ) : null}
    </span>
  );
}
