"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { LazyMotion, domAnimation, m, useInView } from "motion/react";

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

export function LandingMotion({ children }: { children: ReactNode }) {
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
      <LazyMotion features={domAnimation}>
        <div data-motion={enabled ? "on" : "off"} data-loop={looping ? "on" : "off"}>{children}</div>
      </LazyMotion>
    </MotionContext.Provider>
  );
}

export const useLandingMotion = () => useContext(MotionContext);

export function Reveal({ children, className, delay = 0 }: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { enabled } = useLandingMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const visible = useInView(ref, { margin: "80px" });
  // Render content visibly on the server; animation is progressive enhancement.
  return (
    <m.div ref={ref} className={className} initial={false} data-in-view={visible}
      animate={{ opacity: !enabled || inView ? 1 : 0, transform: !enabled || inView ? "translateY(0px)" : "translateY(20px)" }}
      transition={{ duration: enabled ? 0.55 : 0, delay: enabled ? delay : 0, ease: [0.23, 1, 0.32, 1] }}>
      {children}
    </m.div>
  );
}
