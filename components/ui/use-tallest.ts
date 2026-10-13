"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The tallest the element has been on this visit. Given back as a min-height,
 * a shorter view (a narrower filter, a loading line) keeps that room, so what
 * sits under it never moves up on a click and back down when data lands (A7,
 * #594); a taller view still grows the room. The min-height is already in
 * place before the content shrinks, so the shrink itself moves nothing.
 */
export function useTallest<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [tallest, setTallest] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const height = el.offsetHeight;
      setTallest((current) => (height > current ? height : current));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, tallest] as const;
}
