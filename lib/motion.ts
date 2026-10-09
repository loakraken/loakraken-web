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
 *
 * Charts inside it play with the same load (motion guide 7, item 4): a path
 * with `pathLength={1} data-draw` draws itself, an element with
 * `data-grow={i}` grows from its base (`data-grow-axis="x"` from the left;
 * give it `transform-box: fill-box` and the origin in CSS), 30ms apart up to
 * 8 steps. Nothing replays when the chart is shown again from the cache.
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
    // The design system's timing (#186), as on .k-reveal / .k-draw / .k-grow.
    const style = getComputedStyle(node);
    const easing = style.getPropertyValue("--ease-out").trim() || "ease-out";
    node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: seconds(style.getPropertyValue("--duration-reveal"), 240),
      easing,
    });
    const draw = seconds(style.getPropertyValue("--duration-draw"), 600);
    const step = seconds(style.getPropertyValue("--stagger"), 30);
    for (const path of node.querySelectorAll<SVGElement>("[data-draw]"))
      path.animate({ strokeDasharray: ["1 1", "1 1"], strokeDashoffset: [1, 0] }, { duration: draw, easing });
    for (const bar of node.querySelectorAll<HTMLElement | SVGElement>("[data-grow]")) {
      const from = bar.dataset.growAxis === "x" ? "0 1" : "1 0";
      bar.animate({ scale: [from, "1 1"] }, {
        duration: draw,
        delay: Math.min(Number(bar.dataset.grow) || 0, 8) * step,
        easing,
        fill: "backwards",
      });
    }
  }, []);
}
