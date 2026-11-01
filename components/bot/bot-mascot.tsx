"use client";

// The site's bot: one of bot-avatars' 18 bodies (MIT © 2026 Jakub Antalik,
// https://libraries.dev/bots), drawn on our own canvas with the library's own
// rig (BotAvatarSim) and renderer (drawBotAvatarFrame), both public exports.
// The stock <BotAvatar> runs a frame loop for as long as it is on screen and
// only follows a pointer within three head widths; here:
//  - it follows the pointer anywhere in `area` (outside it, it faces front);
//  - automatic motion (blinks, breathing, glances, the working hops) runs
//    only while there is something to answer: for `restAfter` ms after load
//    and after the last pointer move, and the whole time it is `working`.
//    Then it eases into the state's still pose, eyes open, and the frame
//    loop stops (WCAG 2.2.2 without a pause control; no frames while idle);
//  - `paused` (the page's remembered pause) stops the automatic motion
//    only: the head still turns with the pointer, which the visitor drives;
//  - `still` (reduced motion) draws the still pose once and listens to
//    nothing;
//  - plastic for every body, its form baked before its first frame, so a
//    new bot (the picker) is drawn finished at once, never in two steps;
//  - the library (65 KB gzip) loads after the page, never on the server.
//    The box is fixed from the first HTML, so its arrival moves nothing.
// The state API is generic so the same bot can later be the assistant's
// face: working = answering, sleeping = idle.

import { useEffect, useRef, useState, type RefObject } from "react";
import type { BotAvatarPose, BotAvatarSim as Sim, BotAvatarDrawConfig } from "bot-avatars";
import { BOT_NAMES, type BotState, type BotType } from "./bot-types";

export type Lib = typeof import("bot-avatars");
let libPromise: Promise<Lib> | null = null;
export const loadLib = () => (libPromise ??= import("bot-avatars"));

const STATE_WORDS: Record<BotState, string> = { default: "기다리는 중", working: "찾는 중", sleeping: "쉬는 중" };

/** Plastic for every bot (user, 11-01): the plush pile is baked on idle time
 *  and swapped in after a smooth stand-in, which read as a glitch. */
const DEPTH = 0.65;

/**
 * The draw config the stock component builds for a type in plastic, from
 * public exports. Its form is baked here, synchronously, under the key the
 * renderer reads, so the first frame of a type is already the finished one:
 * no stand-in, no swap, nothing blank between two bots.
 */
export function drawConfig(lib: Lib, type: BotType, theme: "light" | "dark", dpr: number, size: number): BotAvatarDrawConfig {
  const preset = lib.botAvatarPresets[type];
  const brightness = preset.brightness ?? 1;
  const saturation = preset.saturation ?? 1.5;
  const color = brightness === 1 && saturation === 1
    ? preset.color
    : lib.shade(preset.color, (Math.min(2, Math.max(0, brightness)) - 1) * 0.35, (Math.min(1.5, Math.max(0, saturation)) - 1) * 0.5);
  const parts = lib.botAvatarParts[type];
  const path = new Path2D(lib.botAvatarShapes[type]);
  lib.warmBotAvatarPlastic(type, path, size * dpr, DEPTH);
  return {
    path,
    face: preset.face,
    faceX: preset.faceX,
    faceY: preset.faceY,
    faceScale: preset.faceScale,
    color,
    ink: lib.autoInk(color),
    shading: "plastic",
    // The library's own plastic light (its defaults outside fabric).
    shadow: 0.35,
    highlight: 1.3,
    light: 300,
    rim: 0.5,
    spread: 1.55,
    depth: DEPTH,
    roundness: 1,
    typeKey: type,
    parts: parts ? parts.split(/(?=M)/).filter((d) => d.trim()).map((d) => new Path2D(d)) : undefined,
    theme,
    dpr,
  };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** The still pose eased toward the live one: k = 0 still, 1 live. */
function blend(rest: BotAvatarPose, live: BotAvatarPose, k: number, out: BotAvatarPose) {
  for (const key of Object.keys(rest) as (keyof BotAvatarPose)[]) {
    if (key === "w") continue;
    (out[key] as number) = mix(rest[key] as number, live[key] as number, k);
  }
  out.w = [mix(rest.w[0], live.w[0], k), mix(rest.w[1], live.w[1], k), mix(rest.w[2], live.w[2], k)];
  return out;
}

export function BotMascot({
  type,
  state = "default",
  size = 120,
  area,
  paused = false,
  still = false,
  restAfter = 5000,
  theme = "light",
  decorative = false,
  label,
}: {
  type: BotType;
  state?: BotState;
  /** The body's box in px; the canvas draws past it for hops, without layout. */
  size?: number;
  /** Where the pointer is followed; outside it the bot faces front. */
  area?: RefObject<HTMLElement | null>;
  paused?: boolean;
  still?: boolean;
  restAfter?: number;
  theme?: "light" | "dark";
  /** Inside a control that names it: hidden from assistive tech. */
  decorative?: boolean;
  label?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLSpanElement>(null);
  const [lib, setLib] = useState<Lib | null>(null);
  // The box as laid out (CSS may size it); the canvas is drawn for it.
  const [boxPx, setBoxPx] = useState(size);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setBoxPx(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const live = useRef({ state, paused });
  const wake = useRef<() => void>(() => {});

  useEffect(() => {
    let gone = false;
    loadLib().then((l) => { if (!gone) setLib(l); }, () => {});
    return () => { gone = true; };
  }, []);

  // The loop reads these each frame; a change is something to answer, so it
  // runs for a while. (Still, it is drawn again in its new pose instead.)
  useEffect(() => {
    live.current = { state, paused };
    wake.current();
  }, [state, paused]);
  const stillState = still ? state : null;

  useEffect(() => {
    const el = canvas.current;
    if (!lib || !el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const over = lib.BOT_AVATAR_OVERSCAN;
    const px = Math.round(boxPx * over * dpr);
    el.width = px;
    el.height = px;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const cfg = drawConfig(lib, type, theme, dpr, boxPx);
    const draw = (pose: BotAvatarPose) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, px, px);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lib.drawBotAvatarFrame(ctx, boxPx, pose, cfg);
      // Where it is looking, in tenths of a radian: written only when that
      // changes (a handful of times a turn), for tests and debugging.
      const turn = `${pose.yaw.toFixed(1)},${pose.pitch.toFixed(1)}`;
      if (el.dataset.botTurn !== turn) el.dataset.botTurn = turn;
    };

    if (stillState) {
      draw(lib.restPose(stillState));
      return;
    }

    const sim: Sim = new lib.BotAvatarSim(Math.random(), live.current.state);
    sim.setJump({ every: 0 }); // no surprise jumps: it moves when you do
    const out = lib.restPose(live.current.state);
    let raf = 0;
    let prev = 0;
    let k = 0; // 0 still … 1 live
    let until = performance.now() + restAfter; // the first seconds after load
    let seen = true;
    // The pointer, as the library's rig reads it: a direction from the head
    // and a strength; set by pointermove, read each frame.
    const ptr = { x: 0, y: 0, s: 0 };

    const tick = (now: number) => {
      raf = 0;
      if (!seen || document.hidden) { prev = 0; el.dataset.botLoop = "parked"; return; }
      const dt = prev ? Math.min(0.1, (now - prev) / 1000) : 1 / 60;
      prev = now;
      const { state: s, paused: p } = live.current;
      if (sim.state !== s) sim.setState(s);
      const active = s === "working" || now < until;
      k = clamp(k + (active ? dt : -dt) / 0.45, 0, 1);
      const rest = lib.restPose(s);
      if (k > 0) {
        sim.setPointer(ptr.x, ptr.y, ptr.s);
        sim.update(dt);
        blend(rest, sim.pose, k, out);
        if (p) {
          // Paused: only what the pointer drives.
          const turn = { yaw: out.yaw, pitch: out.pitch, lookX: out.lookX, lookY: out.lookY };
          blend(rest, rest, 0, out);
          Object.assign(out, turn);
        }
        draw(out);
      }
      if (k > 0 || active) raf = requestAnimationFrame(tick);
      else {
        draw(rest); // settled: the still pose, eyes open; the loop parks
        el.dataset.botLoop = "parked";
      }
    };
    const run = () => {
      if (raf || !seen || document.hidden) return;
      el.dataset.botLoop = "running";
      raf = requestAnimationFrame(tick);
    };
    wake.current = () => { until = performance.now() + restAfter; run(); };

    const aim = (event: PointerEvent) => {
      const box = area?.current?.getBoundingClientRect();
      const inside = box && event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
      if (!box || !inside) {
        if (ptr.s === 0) return;
        ptr.s = 0;
      } else {
        const r = el.getBoundingClientRect();
        const dx = event.clientX - (r.left + r.width / 2);
        const dy = event.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1;
        // As far as the eye tracker looks: the face reaches the rim as the
        // pointer reaches the area's edge.
        const reach = Math.max(60, Math.min(box.width, box.height) * 0.28);
        const far = Math.min(1, Math.tanh(d / reach) * 1.2);
        ptr.x = (dx / d) * far;
        ptr.y = (dy / d) * far;
        ptr.s = 1;
      }
      wake.current();
    };

    draw(lib.restPose(live.current.state));
    run();
    const io = new IntersectionObserver(([entry]) => { seen = entry.isIntersecting; if (seen) run(); });
    io.observe(el);
    const onVisible = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onVisible);
    if (area) window.addEventListener("pointermove", aim, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      wake.current = () => {};
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointermove", aim);
    };
  }, [lib, type, boxPx, theme, still, area, restAfter, stillState]);

  // The box: `--bot-size` from the page's CSS when it sets one (so a
  // breakpoint never resizes it after hydration), else `size`. The canvas
  // draws 1.5× past it (hops, turns) and rises by a tenth, as the library
  // places it, all without layout.
  const box = `var(--bot-size, ${size}px)`;
  return (
    <span
      ref={frame}
      data-bot={type}
      style={{ position: "relative", display: "inline-block", width: box, height: box, flex: "none" }}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label ?? `${BOT_NAMES[type]} 봇, ${STATE_WORDS[state]}` })}
    >
      <canvas
        ref={canvas}
        data-bot-loop="parked"
        style={{
          position: "absolute",
          left: `calc(${box} * -0.25)`,
          top: `calc(${box} * -0.35)`,
          width: `calc(${box} * 1.5)`,
          height: `calc(${box} * 1.5)`,
          opacity: lib ? 1 : 0,
          transition: "opacity 300ms ease-out",
          pointerEvents: "none",
        }}
      />
    </span>
  );
}
