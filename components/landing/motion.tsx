"use client";

import { createContext, useContext, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { LazyMotion, domAnimation, m, useInView, useReducedMotion } from "motion/react";

const MotionContext = createContext({ enabled: false, paused: false, toggle: () => {} });
const subscribe = (callback: () => void) => {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
};
const getVisible = () => document.visibilityState === "visible";
const getServerVisible = () => false;

export function LandingMotion({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const visible = useSyncExternalStore(subscribe, getVisible, getServerVisible);
  const enabled = !reduced && !paused && visible;
  return (
    <MotionContext.Provider value={{ enabled, paused, toggle: () => setPaused((value) => !value) }}>
      <LazyMotion features={domAnimation}>
        <div data-motion={enabled ? "on" : "off"}>{children}</div>
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
