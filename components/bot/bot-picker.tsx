"use client";

// "봇 바꾸기": a small button by the bot that opens a grid of the 18 bodies.
// A radio group (arrow keys move and choose, Enter/Escape close), each body
// drawn once in its still pose — nothing in the grid animates. The choice is
// remembered (useChosenBot) and never blocks anything around it.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Popover } from "@base-ui/react/popover";
import { BOT_NAMES, BOT_TYPES, type BotType } from "./bot-types";
import { drawConfig, loadLib } from "./bot-mascot";
import { useChosenBot } from "./use-chosen-bot";
import styles from "./bot-picker.module.css";

const THUMB = 36;

function Thumb({ type, theme }: { type: BotType; theme: "light" | "dark" }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let gone = false;
    loadLib().then((lib) => {
      const el = canvas.current;
      if (gone || !el) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const px = Math.round(THUMB * lib.BOT_AVATAR_OVERSCAN * dpr);
      el.width = px;
      el.height = px;
      const ctx = el.getContext("2d");
      if (!ctx) return;
      const cfg = { ...drawConfig(lib, type, theme, dpr, THUMB), still: true };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lib.drawBotAvatarFrame(ctx, THUMB, lib.restPose("default"), cfg);
    }, () => {});
    return () => { gone = true; };
  }, [type, theme]);
  return (
    <span className={styles.thumb} aria-hidden="true">
      <canvas ref={canvas} className={styles.thumbCanvas} />
    </span>
  );
}

export function BotPicker({ theme }: { theme: "light" | "dark" }) {
  const [chosen, choose] = useChosenBot();
  const [open, setOpen] = useState(false);
  const options = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const cols = 6;
    const i = BOT_TYPES.indexOf(chosen);
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[event.key];
    if (step === undefined) {
      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const next = event.key === "Home" ? 0 : BOT_TYPES.length - 1;
        choose(BOT_TYPES[next]);
        options.current[next]?.focus();
      }
      return;
    }
    event.preventDefault();
    const next = (i + step + BOT_TYPES.length) % BOT_TYPES.length;
    choose(BOT_TYPES[next]);
    options.current[next]?.focus();
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className={styles.trigger}>봇 바꾸기</Popover.Trigger>
      <Popover.Portal>
        {/* Beside the trigger, so the bot stays in view and changes as you
            choose; below it where the screen is too narrow for that. */}
        <Popover.Positioner side="right" align="end" sideOffset={8} collisionPadding={12}
          collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "end" }} className={styles.positioner}>
          <Popover.Popup className={styles.popup} initialFocus={() => options.current[BOT_TYPES.indexOf(chosen)] ?? null}>
            <Popover.Title className={styles.title}>봇 모양 고르기</Popover.Title>
            <div role="radiogroup" aria-label="봇 모양" className={styles.grid} onKeyDown={onKeyDown}>
              {BOT_TYPES.map((type, i) => (
                <button
                  key={type}
                  ref={(node) => { options.current[i] = node; }}
                  type="button"
                  role="radio"
                  aria-checked={type === chosen}
                  tabIndex={type === chosen ? 0 : -1}
                  className={styles.option}
                  data-bot-option={type}
                  onClick={() => choose(type)}
                >
                  <Thumb type={type} theme={theme} />
                  <span className={styles.name}>{BOT_NAMES[type]}</span>
                </button>
              ))}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
