"use client";

// Reveal without the motion library (#1860): motion/react is one barrel that Turbopack bundles whole, so even a
// lazily loaded feature set left ~55KB (gzip) of motion in the character page's first JS. The entrance is the
// same as before: opacity + 20px rise, 0.55s, cubic-bezier(0.23, 1, 0.32, 1), the same delays, played once when
// the element comes on screen (40px in from the bottom); nothing moves with reduced motion or a hidden tab
// (useLandingMotion().enabled). Pages render visibly on the server and stay visible until an observer has
// reported the element off screen, so content is never left hidden if it never reports.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { MotionScope, useLandingMotion } from "./motion-context";

export { useLandingMotion } from "./motion-context";

/** Kept for the pages that wrap their content in it; the motion scope (enabled, looping) is all it holds now. */
export function LandingMotion({ children }: { children: ReactNode }) {
  return <MotionScope>{children}</MotionScope>;
}

type Watch = (entry: IntersectionObserverEntry) => void;
/** One IntersectionObserver per root margin for every Reveal on the page (not one or two per element). */
const shared = new Map<string, { observer: IntersectionObserver; watches: Map<Element, Watch> }>();

function watch(element: Element, rootMargin: string, onEntry: Watch) {
  let entry = shared.get(rootMargin);
  if (!entry) {
    const watches = new Map<Element, Watch>();
    const observer = new IntersectionObserver((records) => records.forEach((record) => watches.get(record.target)?.(record)), {
      rootMargin,
    });
    entry = { observer, watches };
    shared.set(rootMargin, entry);
  }
  const { observer, watches } = entry;
  watches.set(element, onEntry);
  observer.observe(element);
  return () => {
    if (watches.get(element) !== onEntry) return; // already stopped (the entry callback stops itself once in)
    observer.unobserve(element);
    watches.delete(element);
    if (watches.size === 0) {
      observer.disconnect();
      shared.delete(rootMargin);
    }
  };
}

// Set once the page has hydrated: a Reveal mounted after that (a tab switch, a client navigation) starts hidden and
// plays its entrance, as motion did (its first frame took the hidden values); one hydrated from the server HTML
// starts as the server drew it.
let afterHydration = false;

const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const ENTER = "0px 0px -40px 0px";
const NEAR = "80px";

export function Reveal({ children, className, delay = 0 }: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { enabled } = useLandingMotion();
  const ref = useRef<HTMLDivElement>(null);
  // "unknown" until the observer reports: drawn as shown (the server's state, and the fallback if it never does).
  const [entered, setEntered] = useState<"unknown" | "out" | "in">(() => (afterHydration ? "out" : "unknown"));
  // Near the screen (80px): the page's looping animations inside pause off screen (landing.module.css).
  const [near, setNear] = useState(false);
  useEffect(() => {
    afterHydration = true;
    const element = ref.current;
    if (!element) return;
    const stopEnter = watch(element, ENTER, (record) => {
      if (record.isIntersecting) {
        setEntered("in");
        stopEnter();
      } else setEntered((now) => (now === "unknown" ? "out" : now));
    });
    const stopNear = watch(element, NEAR, (record) => setNear(record.isIntersecting));
    return () => {
      stopEnter();
      stopNear();
    };
  }, []);
  const hidden = enabled && entered === "out";
  const style: CSSProperties | undefined =
    entered === "unknown"
      ? undefined
      : {
          opacity: hidden ? 0 : 1,
          transform: hidden ? "translateY(20px)" : "none",
          transition: enabled
            ? `opacity 0.55s ${EASE} ${delay}s, transform 0.55s ${EASE} ${delay}s`
            : "none",
        };
  return (
    <div ref={ref} className={className} style={style} data-in-view={near}>
      {children}
    </div>
  );
}
