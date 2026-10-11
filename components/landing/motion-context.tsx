"use client";

// Motion state shared by the landing parts, without motion/react: the home
// hero uses it on its own (route budget), /about wraps it in LazyMotion.

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";

/**
 * enabled: one-shot motion (entrances, transitions) may play.
 * looping: repeating motion (orb, border beam, looping CSS) may play. It stops
 * on its own 5s after it starts, so no pause button is needed (WCAG 2.2.2,
 * user 10:57); wake() runs it 5s more: search focus or hover, the orb coming
 * back on screen or being touched, the tab coming back (user, 16:22: the orb
 * stayed still after scrolling away and back). It never stops dead: the CSS
 * loops slow to a halt over the last SETTLE_MS of the 5s, then pause there.
 */
const MotionContext = createContext({ enabled: false, looping: false, wake: () => {} });
const LOOP_MS = 5_000;
const SETTLE_MS = 700;
const noSubscribe = () => () => {};
const subscribe = (callback: () => void) => {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
};
const getVisible = () => document.visibilityState === "visible";
const getServerVisible = () => false;
const subscribeReducedMotion = (callback: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
const getReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const getServerReducedMotion = () => true;

export function MotionScope({ children }: { children: ReactNode }) {
  const reduced = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getServerReducedMotion);
  const visible = useSyncExternalStore(subscribe, getVisible, getServerVisible);
  const enabled = !reduced && visible;
  // The CSS loops start at first paint, before hydration: on the first load
  // count from navigation start, after a client navigation from mount.
  const hydrating = useSyncExternalStore(noSubscribe, () => false, () => true);
  const [startedAt] = useState(() => (hydrating ? 0 : performance.now()));
  const [phase, setPhase] = useState<"awake" | "settling" | "asleep">("awake");
  const [wakes, setWakes] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled) return;
    // Settling starts SETTLE_MS early, so the motion has stopped by 5s.
    const run = LOOP_MS - SETTLE_MS;
    const delay = wakes ? run : Math.max(0, startedAt + run - performance.now());
    const timer = setTimeout(() => setPhase("settling"), delay);
    return () => clearTimeout(timer);
  }, [enabled, wakes, startedAt]);
  // Settling: every repeating CSS animation in the scope slows from full speed
  // to 0 (ease-out), then data-loop="off" pauses it there. playbackRate keeps
  // the current position, so nothing jumps; a wake puts the rate back at 1.
  useEffect(() => {
    const loops = () =>
      (root.current?.getAnimations({ subtree: true }) ?? []).filter(
        (animation) => animation.effect?.getTiming().iterations === Infinity
      );
    if (phase !== "settling") {
      loops().forEach((animation) => (animation.playbackRate = 1));
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / SETTLE_MS);
      const rate = Math.max(0.001, (1 - t) ** 2);
      loops().forEach((animation) => (animation.playbackRate = rate));
      if (t < 1) frame = requestAnimationFrame(step);
      else setPhase("asleep");
    });
    return () => cancelAnimationFrame(frame);
  }, [phase]);
  const wake = useCallback(() => {
    setPhase("awake");
    setWakes((n) => n + 1);
  }, []);
  // The tab coming back runs the loops again (the budget counts while shown).
  // Only a real visibilitychange counts: hydration also turns `visible` from
  // the server's false to true, and that is not a return (#506 review).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") wake();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [wake]);
  const looping = enabled && phase !== "asleep";
  return (
    <MotionContext.Provider value={{ enabled, looping, wake }}>
      <div ref={root} data-motion={enabled ? "on" : "off"} data-loop={looping ? "on" : "off"}>{children}</div>
    </MotionContext.Provider>
  );
}

export const useLandingMotion = () => useContext(MotionContext);


/** wake() each time the element comes back on screen after leaving it (not
 * on its first appearance: the page-load budget already covers that). */
export function useWakeOnReturn(visible: boolean) {
  const { wake } = useLandingMotion();
  const state = useRef<"unseen" | "seen" | "left">("unseen");
  useEffect(() => {
    if (visible) {
      if (state.current === "left") wake();
      state.current = "seen";
    } else if (state.current === "seen") state.current = "left";
  }, [visible, wake]);
}

/** Whether the element is on screen (margin in px), without motion/react. */
export function useVisible(ref: RefObject<Element | null>, margin = 0) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: `${margin}px` });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, margin]);
  return visible;
}
