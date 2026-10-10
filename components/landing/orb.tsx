"use client";

import { useRef } from "react";
import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { useLandingMotion, useVisible } from "./motion-context";
import styles from "./landing.module.css";

export function IntelligenceOrb({ state = "breathing" }: { state?: OrbState }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useVisible(ref, 60);
  // Decorative and repeating: stops with the 5s loop budget.
  const { looping } = useLandingMotion();

  return (
    <div ref={ref} className={styles.orbStage} data-orb-active={looping && visible} aria-hidden="true">
      <div className={styles.orbAtmosphere} />
      <div className={`${styles.orbit} ${styles.orbitOuter}`}><i /></div>
      <div className={`${styles.orbit} ${styles.orbitInner}`}><i /></div>
      <div className={styles.orbShell}>
        <div className={styles.orbGlass} />
        <div className={styles.orbCore}>
          <ThinkingOrb state={state} size={64} theme="light" color="#0066cc" speed={0.65} paused={!looping || !visible} />
        </div>
      </div>
    </div>
  );
}

export function InlineOrb({ state = "searching" }: { state?: OrbState }) {
  const { enabled } = useLandingMotion();
  return <ThinkingOrb state={state} size={20} theme="light" color="#0066cc" paused={!enabled} aria-hidden="true" />;
}
