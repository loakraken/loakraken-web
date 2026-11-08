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
//  - it hops only to answer the visitor, once each: waking, the page
//    asking (`hopOn`, the hero's search box taking focus), a new body (a
//    spin-hop); one press that does two of these is one hop; no idle jumps;
//  - with `lookAt` and `looking` (the hero's search box has focus), it
//    aims at the box's caret exactly as it would at a pointer there, and
//    the aim follows the text as the visitor types (user, 11-04): measured
//    on each keystroke, not each frame; the pointer neither steers nor wakes
//    it then, and it never falls asleep;
//  - `tiltOn` (a count the page raises: the hero's name-format error) is
//    answered with one short head tilt, ~0.7 s, then still (user, 11-03);
//    not paused, not under reduced motion;
//  - `wear` (the picker's hat and glasses, the library's own options) is
//    drawn from the next frame: no new sim, no hop;
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

import { useEffect, useRef, useState, type RefObject } from "react";
import type { BotAvatarPose, BotAvatarSim as Sim, BotAvatarDrawConfig } from "bot-avatars";
import { BOT_NAMES, NO_WEAR, type BotState, type BotType, type BotWear } from "./bot-types";

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
export function drawConfig(lib: Lib, type: BotType, theme: "light" | "dark", dpr: number, size: number, wear?: BotWear): BotAvatarDrawConfig {
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
    ...(wear ? { wear: wearOf(wear) } : {}),
    parts: parts ? parts.split(/(?=M)/).filter((d) => d.trim()).map((d) => new Path2D(d)) : undefined,
    theme,
    dpr,
  };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** The library's wear for our choice; the accessory colour is its default. */
const wearOf = (wear: BotWear) => ({ ...wear, headphones: false, bowTie: false, color: "#27272b" });

/** Pointer-like reach (-1 … 1) of a point from the head's centre, each axis
 *  on its own: the face reaches the rim as the point reaches the window's
 *  edge on that side. (The rig turns 22° per unit across but tips only 12°
 *  per unit up and down, so a direction vector left a wide window's corners
 *  with almost no tilt.) */
const reach = (delta: number, before: number, after: number) =>
  clamp(Math.tanh((1.5 * delta) / Math.max(60, delta > 0 ? after : before)) * 1.1, -1, 1);
const DEG = Math.PI / 180;

/** The rest pose turned to look at a point (x, y in reach units), with the
 *  follow rig's own mapping at full strength (BotAvatarSim.update: the head
 *  22° across and 12° up and down per unit, the eyes 4.5 and 3 units): what
 *  a pointer resting there settles to, without the rig's idle wander and
 *  eye darts. */
function lookPose(base: BotAvatarPose, x: number, y: number, out: BotAvatarPose) {
  blend(base, base, 0, out);
  out.yaw = base.yaw + x * 22 * DEG;
  out.pitch = base.pitch - y * 12 * DEG;
  out.lookX = base.lookX + x * 4.5;
  out.lookY = base.lookY + y * 3;
  return out;
}

let measurer: CanvasRenderingContext2D | null = null;
/** Where the caret is on screen in a text input (the box's centre for any
 *  other element): the text before it measured with the input's own font,
 *  so no mirror element and no layout pass. An empty box: its start. */
function caretPoint(field: HTMLElement) {
  const box = field.getBoundingClientRect();
  const y = box.top + box.height / 2;
  if (!(field instanceof HTMLInputElement)) return { x: box.left + box.width / 2, y };
  const style = getComputedStyle(field);
  measurer ??= document.createElement("canvas").getContext("2d");
  const left = box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
  const right = box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
  if (!measurer) return { x: left, y };
  measurer.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const before = field.value.slice(0, field.selectionEnd ?? field.value.length);
  return { x: clamp(left + measurer.measureText(before).width - field.scrollLeft, left, right), y };
}
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Where t falls between a and b, 0 … 1. */
const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
/** Ease-out with a small pass beyond the end and back: the head nods into place. */
const settle = (t: number) => 1 + 2 * (t - 1) ** 3 + (t - 1) ** 2;

/** The puzzled tilt: one roll to the side and back, in ms, and how far. */
const TILT_MS = 700;
const TILT_ROLL = 14 * (Math.PI / 180);

/** Falling asleep, in seconds (user, 11-03: one snap read as stiff). */
const DOZE = 1.6;

/**
 * Falling asleep as a short sequence instead of one blend (z: 0 awake … 1
 * asleep): the lids droop to about half and blink slowly twice, then the
 * head and body settle into the library's sleeping pose with a small nod,
 * then the eyes close.
 */
function doze(awake: BotAvatarPose, asleep: BotAvatarPose, z: number, out: BotAvatarPose) {
  const head = settle(span(z, 0.3, 0.85));
  const lids = smooth(span(z, 0.55, 0.95));
  blend(awake, asleep, head, out);
  const drowsy = 0.45 * smooth(span(z, 0.05, 0.4));
  out.eyeOpen = mix(awake.eyeOpen, asleep.eyeOpen, Math.max(drowsy, lids));
  const blink = Math.max(Math.sin(Math.PI * span(z, 0.04, 0.18)), Math.sin(Math.PI * span(z, 0.24, 0.4)));
  out.blinkL = Math.max(mix(awake.blinkL, asleep.blinkL, lids), blink);
  out.blinkR = Math.max(mix(awake.blinkR, asleep.blinkR, lids), blink);
  out.w = [mix(awake.w[0], asleep.w[0], lids), mix(awake.w[1], asleep.w[1], lids), mix(awake.w[2], asleep.w[2], lids)];
  return out;
}

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
  hopOn = 0,
  wear = NO_WEAR,
  lookAt,
  looking = false,
  tiltOn = 0,
  greet,
  dozes = true,
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
  /** A count the page raises to ask for one hop each time (not on mount). */
  hopOn?: number;
  /** Hat and glasses (the picker's choice). */
  wear?: BotWear;
  /** An element to look at while `looking` (the hero's search box). */
  lookAt?: RefObject<HTMLElement | null>;
  looking?: boolean;
  /** A count the page raises to ask for one puzzled tilt each time (not on mount). */
  tiltOn?: number;
  /** One motion when it first comes alive (an empty or error note: `tilt`). */
  greet?: "tilt";
  /** Whether the default state falls asleep when it rests (a calm note: false). */
  dozes?: boolean;
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
  /** Run the loop; `held`: draw the new still pose, don't extend the live
   *  time; `ms`: how long it stays live (never shortening a longer one). */
  const wake = useRef<(held?: boolean, ms?: number) => void>(() => {});
  /** Aim again at the watched element (focus, a keystroke, a scroll). */
  const reaim = useRef<() => void>(() => {});
  const hop = useRef<(spin: number) => void>(() => {});
  const tilt = useRef<() => void>(() => {});
  // The body drawn last, to tell a switch from the first drawing.
  const shown = useRef<BotType | null>(null);

  useEffect(() => loadLibLater(setLib), []);

  // The loop reads these each frame; a change is something to answer, so it
  // runs for a while. (Still, it is drawn again in its new pose instead.)
  useEffect(() => {
    live.current = { state, paused };
    wake.current();
  }, [state, paused]);
  // The hero's search box taking focus is answered with one hop (user, 11-03:
  // on submit the page leaves, so a hop there was never seen).
  const asked = useRef(hopOn);
  useEffect(() => {
    if (hopOn === asked.current) return;
    asked.current = hopOn;
    hop.current(0);
  }, [hopOn]);
  const greeted = useRef(false);
  const puzzled = useRef(tiltOn);
  useEffect(() => {
    if (tiltOn === puzzled.current) return;
    puzzled.current = tiltOn;
    tilt.current();
  }, [tiltOn]);
  // Read each frame: a new hat or glasses shows at once, without a new sim
  // or a hop (the body's spin-hop is for a new body only).
  const worn = useRef(wear);
  useEffect(() => {
    worn.current = wear;
    wake.current(true);
  }, [wear]);
  // Looking at the search box: the head turns to it while the live time
  // runs, then holds there still. Paused, the look is drawn once.
  const watched = useRef({ looking, lookAt });
  useEffect(() => {
    watched.current = { looking, lookAt };
    reaim.current();
    wake.current(live.current.paused);
  }, [looking, lookAt]);
  const stillState = still ? state : null;
  const stillLook = still ? looking : null;

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
      cfg.wear = wearOf(worn.current);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, px, px);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lib.drawBotAvatarFrame(ctx, boxPx, pose, cfg);
      // Where it is looking, in tenths of a radian: written only when that
      // changes (a handful of times a turn), for tests and debugging.
      const turn = `${pose.yaw.toFixed(1)},${pose.pitch.toFixed(1)}`;
      if (el.dataset.botTurn !== turn) el.dataset.botTurn = turn;
      // Where the eyes look, the same way (they move the whole reach).
      const look = `${pose.lookX.toFixed(1)},${pose.lookY.toFixed(1)}`;
      if (el.dataset.botLook !== look) el.dataset.botLook = look;
    };

    // Where it looks while the watched element has focus, in reach units from
    // the head: measured on focus, keystrokes and scrolls (never per frame).
    let aimed: { x: number; y: number } | null = null;
    // The point it turns to (focus or pointer), in hundredths of the reach:
    // written on those events only, for tests (the drawn pose also wanders).
    const showAim = (at: { x: number; y: number }) => {
      el.dataset.botAim = `${at.x.toFixed(2)},${at.y.toFixed(2)}`;
    };
    reaim.current = () => {
      const { looking: on, lookAt: ref } = watched.current;
      const field = on ? ref?.current : null;
      if (!field) { aimed = null; return; }
      const point = caretPoint(field);
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      aimed = { x: reach(point.x - cx, cx, innerWidth - cx), y: reach(point.y - cy, cy, innerHeight - cy) };
      showAim(aimed);
    };
    const target = () => (watched.current.looking ? aimed : null);
    reaim.current();
    const looked = lib.restPose("default");
    const tilted = lib.restPose("default");
    let tiltAt = -Infinity;
    // The pose as drawn, with the puzzled tilt on top while it runs.
    const withTilt = (pose: BotAvatarPose, now: number) => {
      const t = (now - tiltAt) / TILT_MS;
      if (t < 0 || t >= 1) return pose;
      blend(pose, pose, 0, tilted);
      tilted.roll = pose.roll + Math.sin(Math.PI * t) * TILT_ROLL;
      return tilted;
    };

    const switched = shown.current !== null && shown.current !== type;
    shown.current = type;
    if (stillState) {
      const at = target();
      draw(at ? lookPose(lib.restPose(stillState), at.x, at.y, looked) : lib.restPose(stillState));
      return;
    }

    const sim: Sim = new lib.BotAvatarSim(Math.random(), live.current.state);
    sim.setJump({ every: 0 }); // no surprise jumps: it moves when you do
    const out = lib.restPose(live.current.state);
    const asleep = lib.restPose("sleeping");
    let raf = 0;
    let prev = 0;
    let k = 0; // 0 still … 1 live
    let z = 0; // the doze, 0 awake … 1 asleep
    let up = 0; // waking: 1 at the pose it woke in … 0 awake
    const woke = lib.restPose("default"); // that pose
    const resting = lib.restPose("default");
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
      const at = target();
      const sleepy = dozes && s === "default" && !p && !active && !at;
      const base = at ? lookPose(lib.restPose(s), at.x, at.y, looked) : lib.restPose(s);
      if (sleepy) {
        z = clamp(z + dt / DOZE, 0, 1);
        up = 0;
      } else if (z > 0) {
        // Woken (mid-doze or asleep): back up quickly from where it is.
        doze(base, asleep, z, woke);
        z = 0;
        up = 1;
      } else up = clamp(up - dt / 0.3, 0, 1);
      const rest = z > 0 ? doze(base, asleep, z, resting) : up > 0 ? blend(base, woke, smooth(up), resting) : base;
      if (k > 0) {
        if (at) sim.setPointer(at.x, at.y, 1);
        else sim.setPointer(ptr.x, ptr.y, ptr.s);
        sim.update(dt);
        blend(rest, sim.pose, k, out);
        if (p) {
          // Paused: only what the pointer drives.
          const turn = { yaw: out.yaw, pitch: out.pitch, lookX: out.lookX, lookY: out.lookY };
          blend(rest, rest, 0, out);
          Object.assign(out, turn);
        }
        draw(withTilt(out, now));
      } else if (z > 0 || up > 0 || now - tiltAt < TILT_MS) {
        // Still (the live pose has faded) but dozing or waking: draw each
        // step. (Only the live part was drawn before, so the doze showed as
        // one snap when the loop parked: the stiffness the user saw, 11-03.)
        draw(withTilt(rest, now));
      }
      if (k > 0 || active || now - tiltAt < TILT_MS || (sleepy ? z < 1 : up > 0)) raf = requestAnimationFrame(tick);
      else {
        // Settled: the still pose (asleep, or awake when paused); the loop parks.
        draw(rest);
        el.dataset.botLoop = "parked";
        el.dataset.botRest = z === 1 ? "asleep" : "awake";
        if (z === 1) wokenHop = true;
      }
    };
    // One-shot hops, each answering something the visitor did (user, 11-02):
    // waking, the page asking, a new body (with a turn). Never on its own,
    // never paused; reduced motion has no loop to hop in. The canvas draws
    // past the box, so a hop moves nothing in the layout.
    let lastHop = -Infinity;
    hop.current = (spin: number) => {
      if (live.current.paused) return;
      // One press, one hop: a click on the search box can wake the bot
      // (pointerdown) and focus the box a moment later.
      const now = performance.now();
      if (now - lastHop < 400) return;
      lastHop = now;
      sim.setJump({ spin });
      sim.poke();
      el.dataset.botHops = String(Number(el.dataset.botHops ?? 0) + 1);
      wake.current();
    };
    tilt.current = () => {
      if (live.current.paused) return;
      tiltAt = performance.now();
      el.dataset.botTilts = String(Number(el.dataset.botTilts ?? 0) + 1);
      wake.current();
    };
    const run = () => {
      if (raf || !seen || document.hidden) return;
      wokenHop = false; // awake now, however it woke
      el.dataset.botLoop = "running";
      el.dataset.botRest = "awake";
      raf = requestAnimationFrame(tick);
    };
    wake.current = (held = false, ms = restAfter) => {
      if (!held) until = Math.max(until, performance.now() + ms);
      run();
    };
    // Typing in the watched box moves the aim with the caret, briefly, then
    // it parks again. Paused: the look stays as it was drawn.
    const typed = () => {
      if (live.current.paused || !watched.current.looking) return;
      reaim.current();
      wake.current(false, 900);
    };
    const reflow = () => { if (watched.current.looking) reaim.current(); };
    const field = lookAt?.current;

    // Strength stays 1 once the pointer has moved: at 0 the library's idle
    // gaze takes the head and turns it side to side on its own, so it could
    // look away from the pointer (the old hero-only area, v0.3.6.1).
    const aim = (event: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      ptr.x = reach(event.clientX - cx, cx, innerWidth - cx);
      ptr.y = reach(event.clientY - cy, cy, innerHeight - cy);
      ptr.s = 1;
      // Looking at the search box: the pointer is kept for afterwards, but it
      // neither turns nor wakes the head (typing and pointing hold the look).
      if (watched.current.looking && !wokenHop) return;
      showAim(ptr);
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
      if (watched.current.looking) { ptr.y = 0; return; }
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
    // Once per mount, the first time the library is here (it loads late).
    if (greet === "tilt" && !greeted.current) {
      greeted.current = true;
      tilt.current();
    }
    const io = new IntersectionObserver(([entry]) => { seen = entry.isIntersecting; if (seen) run(); });
    io.observe(el);
    const onVisible = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onVisible);
    field?.addEventListener("input", typed);
    field?.addEventListener("keyup", typed);
    field?.addEventListener("click", typed);
    window.addEventListener("resize", reflow, { passive: true });
    window.addEventListener("scroll", reflow, { passive: true });
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
      tilt.current = () => {};
      reaim.current = () => {};
      field?.removeEventListener("input", typed);
      field?.removeEventListener("keyup", typed);
      field?.removeEventListener("click", typed);
      window.removeEventListener("resize", reflow);
      window.removeEventListener("scroll", reflow);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointermove", aim);
      window.removeEventListener("pointerdown", aim);
      window.removeEventListener("pointerout", away);
    };
  }, [lib, type, boxPx, theme, still, follow, restAfter, stillState, stillLook, greet, dozes, lookAt]);

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
