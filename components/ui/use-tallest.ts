"use client";

import { useCallback, useRef, useState } from "react";

/**
 * The tallest the element has been on this visit. Given back as a min-height,
 * a shorter view (a narrower filter, a loading line) keeps that room, so what
 * sits under it never moves up on a click and back down when data lands (A7,
 * #594); a taller view still grows the room. The min-height is already in
 * place before the content shrinks, so the shrink itself moves nothing.
 * A callback ref, so an element drawn anew (a keyed list) is watched too.
 */
export function useTallest<T extends HTMLElement = HTMLDivElement>() {
  const [tallest, setTallest] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    const watch = new ResizeObserver(() => {
      const height = el.offsetHeight;
      setTallest((current) => (height > current ? height : current));
    });
    watch.observe(el);
    observer.current = watch;
  }, []);
  return [ref, tallest] as const;
}
