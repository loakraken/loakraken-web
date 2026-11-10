"use client";

// "봇 바꾸기": a small button by the bot that opens a grid of the 18 bodies,
// then what it wears (a hat, glasses: bot-avatars' own options, user 11-03),
// each drawn on the chosen body.
// A radio group (arrow keys move and choose; a click, tap or Enter picks and
// closes, user 11-03; Escape closes), each body
// drawn once in its still pose — nothing in the grid animates. The choice is
// remembered (useChosenBot) and never blocks anything around it.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Popover } from "@base-ui/react/popover";
import {
  BOT_GLASSES, BOT_HATS, BOT_NAMES, BOT_TYPES, GLASSES_NAMES, HAT_NAMES,
  type BotType, type BotWear,
} from "./bot-types";
import { drawConfig, loadLib } from "./bot-mascot";
import { useChosenBot, useChosenWear } from "./use-chosen-bot";
import styles from "./bot-picker.module.css";

const THUMB = 36;
const TRIGGER_LABEL = "봇 바꾸기";

function Thumb({ type, theme, wear }: { type: BotType; theme: "light" | "dark"; wear?: BotWear }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Strings, not the object: a new object each render must not redraw.
  const hat = wear?.hat;
  const glasses = wear?.glasses;
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
      const cfg = { ...drawConfig(lib, type, theme, dpr, THUMB, hat && glasses ? { hat, glasses } : undefined), still: true };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lib.drawBotAvatarFrame(ctx, THUMB, lib.restPose("default"), cfg);
    }, () => {});
    return () => { gone = true; };
  }, [type, theme, hat, glasses]);
  return (
    <span className={styles.thumb} aria-hidden="true" data-thumb={type}>
      <canvas ref={canvas} className={styles.thumbCanvas} />
    </span>
  );
}

export function BotPicker({ theme }: { theme: "light" | "dark" }) {
  const [chosen, choose] = useChosenBot();
  const [wear, chooseWear] = useChosenWear();
  const [open, setOpen] = useState(false);
  // The page header's foot when it opens: the panel stays below it (phones:
  // the hat and glasses rows made it grow up over the logo and menu).
  const [top, setTop] = useState(12);
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
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setTop(Math.max(12, Math.round(document.querySelector("header")?.getBoundingClientRect().bottom ?? 0) + 8));
        setOpen(next);
      }}
    >
      {/* The label also rides on the start tag (data-label, drawn hidden by
          CSS): the first HTML can arrive split right after it, and the button
          must already have its final size then (#1530 CI, A7). */}
      <Popover.Trigger className={styles.trigger} data-label={TRIGGER_LABEL}>
        <span className={styles.triggerLabel}>{TRIGGER_LABEL}</span>
      </Popover.Trigger>
      <Popover.Portal>
        {/* Beside the trigger, so the bot stays in view and changes as you
            choose; below it where the screen is too narrow for that. */}
        <Popover.Positioner side="right" align="end" sideOffset={8} collisionPadding={{ top, right: 12, bottom: 12, left: 12 }}
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
                  onClick={() => { choose(type); setOpen(false); }}
                >
                  <Thumb type={type} theme={theme} wear={wear} />
                  <span className={styles.name}>{BOT_NAMES[type]}</span>
                </button>
              ))}
            </div>
            <WearGroup
              label="모자"
              values={BOT_HATS}
              names={HAT_NAMES}
              value={wear.hat}
              wearOf={(hat) => ({ ...wear, hat })}
              type={chosen}
              theme={theme}
              onPick={(hat, close) => { chooseWear({ ...wear, hat }); if (close) setOpen(false); }}
            />
            <WearGroup
              label="안경"
              values={BOT_GLASSES}
              names={GLASSES_NAMES}
              value={wear.glasses}
              wearOf={(glasses) => ({ ...wear, glasses })}
              type={chosen}
              theme={theme}
              onPick={(glasses, close) => { chooseWear({ ...wear, glasses }); if (close) setOpen(false); }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** One thing to wear: a small radio row, each option drawn on the chosen
 *  body. Arrows move and choose (the bot shows it at once); a click, tap or
 *  Enter picks and closes, like the bodies. */
function WearGroup<T extends string>({
  label, values, names, value, wearOf, type, theme, onPick,
}: {
  label: string;
  values: readonly T[];
  names: Record<T, string>;
  value: T;
  wearOf: (value: T) => BotWear;
  type: BotType;
  theme: "light" | "dark";
  onPick: (value: T, close: boolean) => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = (values.indexOf(value) + step + values.length) % values.length;
    onPick(values[next], false);
    buttons.current[next]?.focus();
  }
  return (
    <>
      <p className={styles.subtitle} id={`bot-wear-${label}`}>{label}</p>
      <div role="radiogroup" aria-labelledby={`bot-wear-${label}`} className={styles.wear} onKeyDown={onKeyDown}>
        {values.map((option, i) => (
          <button
            key={option}
            ref={(node) => { buttons.current[i] = node; }}
            type="button"
            role="radio"
            aria-checked={option === value}
            tabIndex={option === value ? 0 : -1}
            className={styles.option}
            data-bot-wear={option}
            onClick={() => onPick(option, true)}
          >
            <Thumb type={type} theme={theme} wear={wearOf(option)} />
            <span className={styles.name}>{names[option]}</span>
          </button>
        ))}
      </div>
    </>
  );
}
