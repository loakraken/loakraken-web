"use client";

import { useRef } from "react";
import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { useTheme } from "@/components/ui/theme-toggle";
import { useLandingMotion, useReducedMotion, useVisible } from "./motion-context";

// The orb takes the site theme and our link blue for it (--link: #0066cc
// light, #4da3ff dark), so it never draws a light orb on a dark page.
export const orbColor = (theme: "light" | "dark") => (theme === "dark" ? "#4da3ff" : "#0066cc");
import styles from "./landing.module.css";

export function IntelligenceOrb({ state = "breathing" }: { state?: OrbState }) {
  const ref = useRef<HTMLDivElement & HTMLButtonElement>(null);
  const visible = useVisible(ref, 60);
  // It keeps moving, so the orb itself is the pause button (WCAG 2.2.2; user,
  // 20:58: no separate stop button). A toggle with one fixed name and
  // aria-pressed — the name does not flip with the state. With reduced motion
  // nothing moves, so it is only a picture.
  const { looping, paused, togglePaused } = useLandingMotion();
  const reduced = useReducedMotion();
  const theme = useTheme();
  const Stage = reduced ? "div" : "button";

  return (
    <Stage
      ref={ref}
      className={styles.orbStage}
      data-orb-active={looping && visible}
      {...(reduced
        ? { "aria-hidden": true }
        : { type: "button" as const, "aria-label": "애니메이션 멈춤", "aria-pressed": paused, onClick: togglePaused })}
    >
      <div className={styles.orbAtmosphere} />
      <div className={`${styles.orbit} ${styles.orbitOuter}`}><i /></div>
      <div className={`${styles.orbit} ${styles.orbitInner}`}><i /></div>
      <div className={styles.orbShell}>
        <div className={styles.orbGlass} />
        <div className={styles.orbCore}>
          <ThinkingOrb state={state} size={64} theme={theme} color={orbColor(theme)} speed={0.65} paused={!looping || !visible} />
        </div>
      </div>
    </Stage>
  );
}

export function InlineOrb({ state = "searching" }: { state?: OrbState }) {
  const { enabled } = useLandingMotion();
  const theme = useTheme();
  return <ThinkingOrb state={state} size={20} theme={theme} color={orbColor(theme)} paused={!enabled} aria-hidden="true" />;
}
