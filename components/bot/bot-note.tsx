"use client";

// A small bot beside an empty or error message (user, 11-04): the visitor's
// chosen body and wear, in a fixed box from the first HTML (nothing moves when
// the drawing arrives), hidden from assistive tech: the copy is read as
// before. One short motion when it appears, then still:
//  - `puzzled` (nothing found): the head tilt;
//  - `asleep` (the official server did not answer): its sleeping pose;
//  - `calm` (nothing here yet): awake, never dozing off.
// Reduced motion: the still pose only.
// `inline` (a one-line row with a fixed height, like the market's favourites
// bar): a smaller bot in the line, never above the copy, so the row keeps
// the same height as what replaces it after loading.

import type { ReactNode } from "react";
import { BotMascot } from "./bot-mascot";
import { useChosenBot, useChosenWear } from "./use-chosen-bot";
import { useReducedMotion } from "@/components/landing/motion-context";
import { useTheme } from "@/components/ui/theme-toggle";
import styles from "./bot-note.module.css";

/** The bot's box in a one-line row (px). */
const INLINE_SIZE = 28;

export type BotMood = "puzzled" | "asleep" | "calm";

export function BotNote({
  mood,
  children,
  className,
  inline = false,
}: {
  mood: BotMood;
  children: ReactNode;
  className?: string;
  inline?: boolean;
}) {
  const [bot] = useChosenBot();
  const [wear] = useChosenWear();
  const reduced = useReducedMotion();
  const theme = useTheme();
  return (
    <div
      className={[styles.note, inline && styles.inline, className].filter(Boolean).join(" ")}
      data-bot-note={mood}
    >
      <span className={styles.bot}>
        <BotMascot
          type={bot}
          wear={wear}
          state={mood === "asleep" ? "sleeping" : "default"}
          size={inline ? INLINE_SIZE : 56}
          restAfter={1200}
          still={reduced}
          theme={theme}
          greet={mood === "puzzled" ? "tilt" : undefined}
          dozes={false}
          decorative
        />
      </span>
      <div className={styles.copy}>{children}</div>
    </div>
  );
}
