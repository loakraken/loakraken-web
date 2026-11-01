"use client";

// The site's bot: one of bot-avatars' 18 bodies (MIT © 2026 Jakub Antalik,
// https://libraries.dev/bots), drawn on our own canvas with the library's own
// rig (BotAvatarSim) and renderer (drawBotAvatarFrame), both public exports.
// The stock <BotAvatar> runs a frame loop for as long as it is on screen and
// only follows a pointer within three head widths; here:
//  - with `follow`, it follows the pointer anywhere in the window, header
//    included (user, 11-02), and faces front once a mouse leaves the window;
//  - automatic motion (blinks, breathing, glances, the working hops) runs
//    only while there is something to answer: for `restAfter` ms after load
//    and after the last pointer move, and the whole time it is `working`.
//    Then it eases into a still pose and the frame loop stops (WCAG 2.2.2
//    without a pause control; no frames while idle): in the default state it
//    falls asleep (head down, lids shut; user, 11-02) and wakes on the next
//    pointer move or tap; working, it rests in its own pose;
//  - it hops only to answer the visitor, once each: waking, a search
//    starting (working), a new body (a spin-hop); no idle jumps;
//  - `paused` (the page's remembered pause) stops the automatic motion
//    only: the head still turns with the pointer, which the visitor drives,
//    and it rests awake;
//  - `still` (reduced motion) draws the still pose once and listens to
//    nothing;
//  - plastic for every body, its form baked before its first frame, so a
//    new bot (the picker) is drawn finished at once, never in two steps;
//  - the library (65 KB gzip) is not part of the page's first load: it is
//    fetched once the page has loaded and the browser is idle, or on the
//    first input. The box is fixed from the first HTML (empty until then),
//    so its arrival moves nothing.
// The state API is generic so the same bot can later be the assistant's
// face: working = answering, sleeping = idle.

import { useEffect, useRef, useState } from "react";
import type { BotAvatarPose, BotAvatarSim as Sim, BotAvatarDrawConfig } from "bot-avatars";
import { BOT_NAMES, type BotState, type BotType } from "./bot-types";

export type Lib = typeof import("bot-avatars");
let libPromise: Promise<Lib> | null = null;
export const loadLib = () => (libPromise ??= import("bot-avatars"));

/**
 * Loads the library only once the page has finished loading and the browser
 * is idle (at most 2 s later), or sooner on the first pointer, key or touch:
 * never in the page's first load (PM-프론트 11-02: it added 53 KB there).
 * Until then the box stays empty in place, so its arrival moves nothing.
 */
function loadLibLater(done: (lib: Lib) => void) {
  let gone = false;
  let idle = 0;
  let timer = 0;
  const inputs = ["pointermove", "pointerdown", "keydown", "touchstart"] as const;
  const start = () => {
    stop();
    loadLib().then((lib) => { if (!gone) done(lib); }, () => {});
  };
  const whenIdle = () => {
    if (typeof requestIdleCallback === "function") idle = requestIdleCallback(start, { timeout: 2000 });
    else timer = window.setTimeout(start, 1000);
  };
  const stop = () => {
    inputs.forEach((type) => window.removeEventListener(type, start));
    window.removeEventListener("load", whenIdle);
    if (idle) cancelIdleCallback(idle);
    window.clearTimeout(timer);
  };
  inputs.forEach((type) => window.addEventListener(type, start, { passive: true }));
  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle);
  return () => { gone = true; stop(); };
}

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
  follow = false,
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
  /** Follow the pointer anywhere in the window. */
  follow?: boolean;
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
  const hop = useRef<(spin: number) => void>(() => {});
  // The body drawn last, to tell a switch from the first drawing.
  const shown = useRef<BotType | null>(null);

  useEffect(() => loadLibLater(setLib), []);

  // The loop reads these each frame; a change is something to answer, so it
  // runs for a while. (Still, it is drawn again in its new pose instead.)
  // Starting work (a search) is answered with one hop first (user, 11-02).
  useEffect(() => {
    const started = state === "working" && live.current.state !== "working";
    live.current = { state, paused };
    if (started) hop.current(0);
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

    const switched = shown.current !== null && shown.current !== type;
    shown.current = type;
    if (stillState) {
      draw(lib.restPose(stillState));
      return;
    }

    const sim: Sim = new lib.BotAvatarSim(Math.random(), live.current.state);
    sim.setJump({ every: 0 }); // no surprise jumps: it moves when you do
    const out = lib.restPose(live.current.state);
    const asleep = lib.restPose("sleeping");
    const restOut = lib.restPose("default");
    let raf = 0;
    let prev = 0;
    let k = 0; // 0 still … 1 live
    let z = 0; // 0 awake … 1 asleep
    let wokenHop = false; // asleep: the next pointer wakes it with a hop
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
      // Resting in the default state, it falls asleep: head down, lids shut
      // (user, 11-02). Not while working, nor while paused (paused rests awake).
      const sleepy = s === "default" && !p && !active;
      z = clamp(z + (sleepy ? dt / 1.2 : -dt / 0.5), 0, 1);
      const rest = z > 0 ? blend(lib.restPose(s), asleep, z * z * (3 - 2 * z), restOut) : lib.restPose(s);
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
      if (k > 0 || active || z !== (sleepy ? 1 : 0)) raf = requestAnimationFrame(tick);
      else {
        // Settled: the still pose (asleep, or awake when paused); the loop parks.
        draw(rest);
        el.dataset.botLoop = "parked";
        el.dataset.botRest = z === 1 ? "asleep" : "awake";
        if (z === 1) wokenHop = true;
      }
    };
    // One-shot hops, each answering something the visitor did (user, 11-02):
    // waking, a search, a new body (with a turn). Never on its own, never
    // paused; reduced motion has no loop to hop in. The canvas draws past the
    // box, so a hop moves nothing in the layout.
    hop.current = (spin: number) => {
      if (live.current.paused) return;
      sim.setJump({ spin });
      sim.poke();
      el.dataset.botHops = String(Number(el.dataset.botHops ?? 0) + 1);
      wake.current();
    };
    const run = () => {
      if (raf || !seen || document.hidden) return;
      el.dataset.botLoop = "running";
      el.dataset.botRest = "awake";
      raf = requestAnimationFrame(tick);
    };
    wake.current = () => { until = performance.now() + restAfter; run(); };

    // Strength stays 1 once the pointer has moved: at 0 the library's idle
    // gaze takes the head and turns it side to side on its own, so it could
    // look away from the pointer (the old hero-only area, v0.3.6.1).
    const aim = (event: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // Each axis on its own: the face reaches the rim as the pointer reaches
      // the window's edge on that side. (The rig turns 22° per unit across
      // but tips only 12° per unit up and down, so a direction vector left a
      // wide window's corners with almost no tilt.)
      const reach = (delta: number, before: number, after: number) =>
        clamp(Math.tanh((1.5 * delta) / Math.max(60, delta > 0 ? after : before)) * 1.1, -1, 1);
      ptr.x = reach(event.clientX - cx, cx, innerWidth - cx);
      ptr.y = reach(event.clientY - cy, cy, innerHeight - cy);
      ptr.s = 1;
      if (wokenHop) {
        wokenHop = false;
        // Pressing the bot itself is its pause control: it wakes without a hop.
        const control = event.type === "pointerdown" ? el.closest("button") : null;
        if (!control?.contains(event.target as Node)) hop.current(0);
      }
      wake.current();
    };
    // A mouse or pen leaving the window: face front. A lifted finger also
    // "leaves"; the head stays where it was until it rests.
    const away = (event: PointerEvent) => {
      if (event.relatedTarget || event.pointerType === "touch") return;
      ptr.x = 0;
      ptr.y = 0;
      wake.current();
    };

    draw(lib.restPose(live.current.state));
    if (switched) {
      // A new body is already a new pose: it comes in live, turning in its hop.
      k = 1;
      hop.current(1);
    }
    run();
    const io = new IntersectionObserver(([entry]) => { seen = entry.isIntersecting; if (seen) run(); });
    io.observe(el);
    const onVisible = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onVisible);
    if (follow) {
      window.addEventListener("pointermove", aim, { passive: true });
      // A tap moves no pointer before it: it wakes the bot and aims it too.
      window.addEventListener("pointerdown", aim, { passive: true });
      window.addEventListener("pointerout", away, { passive: true });
    }
    return () => {
      cancelAnimationFrame(raf);
      wake.current = () => {};
      hop.current = () => {};
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointermove", aim);
      window.removeEventListener("pointerdown", aim);
      window.removeEventListener("pointerout", away);
    };
  }, [lib, type, boxPx, theme, still, follow, restAfter, stillState]);

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
        data-bot-rest="awake"
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
