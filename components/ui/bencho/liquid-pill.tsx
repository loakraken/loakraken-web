"use client";
import "./command-bar.css";
import { useEffect, useRef } from "react";
import { Liquid } from "liquid-gooey";

/**
 * The command bar's liquid surface on its own (PM 총괄 11-08, option b): a
 * decorative body the size of the bar, drawn under the plain field
 * (command-field.tsx) once the dialog is open and the page is idle. Same
 * library settings as Bencho's command bar (bridge 3, edge 22, opaque fill,
 * no shadow); nothing in it can take focus or a click.
 *
 * `onShown` fires when its fade-in has ended (or on its first frame when
 * motion is reduced and there is no fade): only then may the plain field drop
 * its own fill, so the page behind never shows through (#1423 review). A fade
 * that is cancelled (interrupted, or a hidden tab that never runs it) hands
 * over too, and a safety timer after SHOWN_BY_MS makes sure the hand-over
 * happens even when no animation event comes at all. `onShown` may fire more
 * than once; the caller only sets a flag.
 */
const SHOWN_BY_MS = 1000;

export function LiquidPill({ onShown }: { onShown?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (getComputedStyle(el).animationName === "none") {
      const id = requestAnimationFrame(() => onShown?.());
      return () => cancelAnimationFrame(id);
    }
    // React has no animationcancel prop, so both events are listened to here.
    const ended = (event: AnimationEvent) => {
      if (event.target === el) onShown?.();
    };
    const id = setTimeout(() => onShown?.(), SHOWN_BY_MS);
    el.addEventListener("animationend", ended);
    el.addEventListener("animationcancel", ended);
    return () => {
      clearTimeout(id);
      el.removeEventListener("animationend", ended);
      el.removeEventListener("animationcancel", ended);
    };
  }, [onShown]);
  return (
    <div ref={ref} className="cmd-liquid" aria-hidden="true">
      <Liquid className="cmd-goo" blur={3} contrast={22} fill="var(--fill-slab, var(--board))" filterPadding={60}>
        <Liquid.Item className="cmd-slot">
          <div className="cmd-shape" />
        </Liquid.Item>
      </Liquid>
    </div>
  );
}
