"use client";

import { useRef, useSyncExternalStore, type ReactNode } from "react";
import { LazyMotion, domAnimation, m, useInView } from "motion/react";
import { MotionScope, useLandingMotion } from "./motion-context";
import { introStore } from "./intro-state";

export { useLandingMotion } from "./motion-context";

export function LandingMotion({ children }: { children: ReactNode }) {
  return (
    <MotionScope>
      <LazyMotion features={domAnimation}>{children}</LazyMotion>
    </MotionScope>
  );
}

export function Reveal({ children, className, delay = 0, build }: {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** A block the /about intro builds ("box" for a picture, card or panel). */
  build?: "text" | "box";
}) {
  const motion = useLandingMotion();
  // While the /about intro builds the page, its blocks do not also slide in.
  const intro = useSyncExternalStore(introStore.subscribe, introStore.snapshot, introStore.serverSnapshot);
  const enabled = motion.enabled && !intro;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const visible = useInView(ref, { margin: "80px" });
  // Render content visibly on the server; animation is progressive enhancement.
  return (
    <m.div ref={ref} className={className} initial={false} data-in-view={visible}
      data-build-block={build ? "" : undefined} data-build-kind={build}
      animate={{ opacity: !enabled || inView ? 1 : 0, transform: !enabled || inView ? "translateY(0px)" : "translateY(20px)" }}
      transition={{ duration: enabled ? 0.55 : 0, delay: enabled ? delay : 0, ease: [0.23, 1, 0.32, 1] }}>
      {children}
    </m.div>
  );
}
