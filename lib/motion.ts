import { useCallback, useEffect, useRef } from "react";

const seconds = (value: string, fallback: number) => {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return value.trim().endsWith("ms") ? n : n * 1000;
};

/**
 * Loading → content (motion guide 7.2): content that replaces a loading
 * placeholder fades in where the placeholder stood, with no travel, so
 * nothing jumps. Only the first appearance after a real load plays it: content
 * already in the server HTML, content shown again from the cache (a period or
 * tab switched back) and content that changes in place do not. Reduced
 * motion shows it at once.
 *
 * Usage: `const fade = useCrossfade(query.isPending);` then
 * `<ul ref={fade} className={styles.rows}>` on the loaded content.
 */
export function useCrossfade(loading: boolean) {
  // A placeholder is on screen. The content that replaces it mounts in the
  // same commit as the load ends, and its ref runs before this effect; once
  // the load is over, anything shown later (an empty message first, the list
  // again from the cache) is no longer the load's result and does not fade.
  const waiting = useRef(loading);
  useEffect(() => {
    waiting.current = loading;
  }, [loading]);
  return useCallback((node: HTMLElement | null) => {
    if (!node || !waiting.current) return;
    waiting.current = false;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // The design system's reveal timing (#186), as on .k-reveal.
    const style = getComputedStyle(node);
    node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: seconds(style.getPropertyValue("--duration-reveal"), 240),
      easing: style.getPropertyValue("--ease-out").trim() || "ease-out",
    });
  }, []);
}
