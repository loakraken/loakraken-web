"use client";

// Motion state shared by the landing parts, without motion/react: the home
// hero uses it on its own (route budget), /about wraps it in LazyMotion.

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";

/**
 * enabled: one-shot motion (entrances, transitions) may play.
 * looping: repeating motion (orb, border beam, looping CSS) may play. It stops
 * on its own 5s after it starts, so no pause button is needed (WCAG 2.2.2,
 * user 10:57); wake() runs it 5s more (search focus or hover).
 */
const MotionContext = createContext({ enabled: false, looping: false, wake: () => {} });
const LOOP_MS = 5_000;
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
  const [awake, setAwake] = useState(true);
  const [wakes, setWakes] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const delay = wakes ? LOOP_MS : Math.max(0, startedAt + LOOP_MS - performance.now());
    const timer = setTimeout(() => setAwake(false), delay);
    return () => clearTimeout(timer);
  }, [enabled, wakes, startedAt]);
  const wake = useCallback(() => {
    setAwake(true);
    setWakes((n) => n + 1);
  }, []);
  const looping = enabled && awake;
  return (
    <MotionContext.Provider value={{ enabled, looping, wake }}>
      <div data-motion={enabled ? "on" : "off"} data-loop={looping ? "on" : "off"}>{children}</div>
    </MotionContext.Provider>
  );
}

export const useLandingMotion = () => useContext(MotionContext);


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
