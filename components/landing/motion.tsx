"use client";

import { useRef, type ReactNode } from "react";
import { LazyMotion, m, useInView } from "motion/react";
import { MotionScope, useLandingMotion } from "./motion-context";

export { useLandingMotion } from "./motion-context";

// The animation features come after the first paint (#1860): the same loader the search panel and 순서 바꾸기 use.
// Pages render visibly on the server (Reveal: initial false), so until they arrive only the entrance waits;
// nothing moves. It kept ~60KB (gzip) out of the character page's first JS.
const loadFeatures = () => import("@/lib/motion-dom-animation").then((mod) => mod.default);

export function LandingMotion({ children }: { children: ReactNode }) {
  return (
    <MotionScope>
      <LazyMotion features={loadFeatures}>{children}</LazyMotion>
    </MotionScope>
  );
}

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
