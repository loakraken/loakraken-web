"use client";

import { useRef } from "react";
import { useInView } from "motion/react";
import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { useLandingMotion } from "./motion";
import styles from "./landing.module.css";

export function IntelligenceOrb({ state = "breathing" }: { state?: OrbState }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: "60px" });
  const { enabled } = useLandingMotion();

  return (
    <div ref={ref} className={styles.orbStage} data-orb-active={enabled && visible} aria-hidden="true">
      <div className={styles.orbAtmosphere} />
      <div className={`${styles.orbit} ${styles.orbitOuter}`}><i /></div>
      <div className={`${styles.orbit} ${styles.orbitInner}`}><i /></div>
      <div className={styles.orbShell}>
        <div className={styles.orbGlass} />
        <div className={styles.orbCore}>
          <ThinkingOrb state={state} size={64} theme="light" color="#0066cc" speed={0.65} paused={!enabled || !visible} />
        </div>
      </div>
    </div>
  );
}

export function InlineOrb({ state = "searching" }: { state?: OrbState }) {
  const { enabled } = useLandingMotion();
  return <ThinkingOrb state={state} size={20} theme="light" color="#0066cc" paused={!enabled} aria-hidden="true" />;
}
