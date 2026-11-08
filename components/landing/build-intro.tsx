"use client";

// /about builds itself (user 11-08): twelve plain coloured arrow cursors, one
// per team, build the page section by section. Up to four work on a section
// (a dashed marquee, a grey skeleton, then the real content); the others wait
// at the edges (on phones they are not shown). The headline and the hero's
// two paragraphs are shown from the first paint (the largest text, the LCP
// candidates) and never hidden; the bot is a canvas, not an LCP candidate.
//
// Only the hiding depends on this script: the content is in the HTML, and the
// page is finished as served without JS, under reduced motion, when the
// visitor has paused motion, and after the intro played once in this tab
// (aboutIntroScript decides before the first paint). One requestAnimationFrame
// loop runs it and parks whenever nothing moves; every box keeps its size.

import { useEffect, useRef, useState } from "react";
import styles from "./build-intro.module.css";

import { INTRO_CLASS, INTRO_END_EVENT, PLAYED_KEY } from "./intro-state";
import { CREW, CURSOR_COLORS } from "./intro-crew";

/** A cursor is its index into CURSOR_COLORS. */
type Team = number;

const TRAVEL = 620;
const DRAG = 460;
const HOLD = 280;

type Cursor = { el: HTMLDivElement; x: number; y: number; color: string };
type Job = { at: number; run: (now: number) => void };
type Tween = { start: number; dur: number; step: (k: number) => void };

/**
 * cubic-bezier(x1, y1, x2, y2) as a function of time (Newton steps, then
 * bisection), so the movement uses the exact curve, not an approximation.
 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const a = (p1: number, p2: number) => 1 - 3 * p2 + 3 * p1;
  const b = (p1: number, p2: number) => 3 * p2 - 6 * p1;
  const c = (p1: number) => 3 * p1;
  const at = (t: number, p1: number, p2: number) => ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t;
  const slope = (t: number, p1: number, p2: number) => 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1);
  return (x: number) => {
    if (x <= 0 || x >= 1) return x <= 0 ? 0 : 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const d = slope(t, x1, x2);
      if (Math.abs(d) < 1e-6) break;
      t -= (at(t, x1, x2) - x) / d;
    }
    if (t < 0 || t > 1 || Math.abs(at(t, x1, x2) - x) > 1e-4) {
      let lo = 0;
      let hi = 1;
      t = x;
      for (let i = 0; i < 24; i++) {
        if (at(t, x1, x2) < x) lo = t;
        else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return at(t, y1, y2);
  };
}
/** On-screen movement (cursors travelling, a marquee dragged out): the strong ease-in-out. */
const ease = cubicBezier(0.77, 0, 0.175, 1);

export function BuildIntro() {
  const layer = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const finishRef = useRef<() => void>(() => {});

  useEffect(() => {
    const root = document.documentElement;
    const host = layer.current;
    if (!host || !root.classList.contains(INTRO_CLASS)) return;
    // The class was set before hydration (aboutIntroScript): show the skip button.
    setActive(true);

    const phone = window.matchMedia("(max-width: 480px)");
    // The layer covers the whole page and clips what it draws, so a cursor
    // waiting past the right edge never widens the page.
    const fit = () => {
      host.style.height = `${root.scrollHeight}px`;
    };
    fit();
    const cursors = new Map<Team, Cursor>();
    CURSOR_COLORS.forEach((color, i) => {
      const el = document.createElement("div");
      el.className = styles.cursor;
      el.dataset.introCursor = String(i);
      // Shown or not from its first frame (no fade on the first look).
      el.style.opacity = !phone.matches || CREW.intro.includes(i) ? "1" : "0";
      el.innerHTML = `<svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true"><path d="M1.5 1.5 L16 12 L9.4 12.9 L5.6 20 Z" fill="${color}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
      host.appendChild(el);
      const c = { el, x: i % 2 ? innerWidth + 40 : -60, y: scrollY + 90 + ((i * 61) % Math.max(200, innerHeight - 120)), color };
      cursors.set(i, c);
      place(c);
    });
    function place(c: Cursor) {
      c.el.style.transform = `translate3d(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px,0)`;
    }
    function showCrew(crew: readonly Team[]) {
      for (const [name, c] of cursors) c.el.style.opacity = !phone.matches || crew.includes(name) ? "1" : "0";
    }

    // ---- one rAF loop over timed jobs and tweens; it parks when nothing is left ----
    let jobs: Job[] = [];
    let tweens: Tween[] = [];
    let raf = 0;
    let done = false;
    // Anything that throws later (in a frame or an observer callback) finishes
    // the page instead of leaving blocks hidden.
    const safe =
      <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        try {
          fn(...args);
        } catch {
          finish();
        }
      };
    const frame = safe(tick);
    const wake = () => {
      if (raf || done) return;
      raf = requestAnimationFrame(frame);
      root.dataset.introLoop = "running";
    };
    const at = (time: number, run: Job["run"]) => {
      jobs.push({ at: time, run });
      wake();
    };
    function tick(now: number) {
      raf = 0;
      jobs.sort((a, b) => a.at - b.at);
      while (jobs.length && jobs[0].at <= now) jobs.shift()!.run(now);
      tweens = tweens.filter((tw) => {
        const t = Math.min(1, (now - tw.start) / tw.dur);
        tw.step(ease(Math.max(0, t)));
        return t < 1;
      });
      if (!done && (jobs.length || tweens.length)) raf = requestAnimationFrame(frame);
      else root.dataset.introLoop = "parked";
    }
    function move(c: Cursor, x: number, y: number, start: number, dur: number) {
      let fx: number | undefined;
      let fy = 0;
      tweens.push({
        start,
        dur,
        step: (k) => {
          if (fx === undefined) {
            fx = c.x;
            fy = c.y;
          }
          c.x = fx + (x - fx) * k;
          c.y = fy + (y - fy) * k;
          place(c);
        },
      });
      wake();
    }
    const pageBox = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
    };

    // ---- one block: travel, drag a marquee, a grey skeleton, the real thing ----
    function buildBlock(block: HTMLElement, box: ReturnType<typeof pageBox>, c: Cursor, t0: number) {
      // Shown from the first paint (the headline): nothing to build.
      if (block.dataset.buildKind === "keep") {
        block.dataset.built = "";
        return t0;
      }
      move(c, box.x - 4, box.y - 4, t0, TRAVEL);
      let marquee: HTMLDivElement | null = null;
      at(t0 + TRAVEL, (now) => {
        marquee = document.createElement("div");
        marquee.className = styles.marquee;
        marquee.style.borderColor = c.color;
        marquee.style.background = `${c.color}14`;
        marquee.style.width = `${box.w}px`;
        marquee.style.height = `${box.h}px`;
        marquee.style.transform = `translate3d(${box.x}px,${box.y}px,0) scale(0.02)`;
        host!.appendChild(marquee);
        const m = marquee;
        tweens.push({ start: now, dur: DRAG, step: (k) => (m.style.transform = `translate3d(${box.x}px,${box.y}px,0) scale(${Math.max(0.02, k)})`) });
        move(c, box.x + box.w - 6, box.y + box.h - 6, now, DRAG);
      });
      // Drawn in the layer over the block (React's own elements are never touched).
      const skeleton = document.createElement("div");
      skeleton.className = block.dataset.buildKind === "box" ? `${styles.skeleton} ${styles.skeletonBox}` : styles.skeleton;
      Object.assign(skeleton.style, { width: `${box.w}px`, height: `${box.h}px`, transform: `translate3d(${box.x}px,${box.y}px,0)` });
      at(t0 + TRAVEL + DRAG, () => {
        host!.appendChild(skeleton);
        requestAnimationFrame(() => skeleton.classList.add(styles.on));
      });
      const ready = t0 + TRAVEL + DRAG + HOLD;
      at(ready, () => {
        block.dataset.built = "";
        skeleton.classList.remove(styles.on);
        marquee?.remove();
      });
      at(ready + 200, () => skeleton.remove());
      return ready + 200;
    }
    // Waiting teams line up at the edges of the screen, out of the way.
    function bench(crew: readonly Team[], t0: number) {
      showCrew(crew);
      [...cursors.keys()]
        .filter((name) => !crew.includes(name))
        .forEach((name, i) => {
          const c = cursors.get(name)!;
          const x = (i % 2 ? innerWidth - 120 : 24) + scrollX;
          move(c, x, scrollY + 120 + ((i * 64) % Math.max(160, innerHeight - 200)), t0 + i * 40, 900);
        });
    }

    // One section at a time (at most four cursors working); later ones wait their turn.
    const sections = [...document.querySelectorAll<HTMLElement>("[data-build-section]")];
    const built = new Set<string>();
    const queue: HTMLElement[] = [];
    let busy = false;
    function request(section: HTMLElement) {
      const id = section.dataset.buildSection!;
      if (built.has(id) || done) return;
      built.add(id);
      queue.push(section);
      if (!busy) next();
    }
    function next() {
      const section = queue.shift();
      if (!section) {
        busy = false;
        return;
      }
      busy = true;
      fit();
      // Every block's place is read before anything is written (one layout per section).
      const blocks = [...section.querySelectorAll<HTMLElement>("[data-build-block]")].filter((block) => {
        if (block.dataset.buildKind !== "keep") return true;
        block.dataset.built = "";
        return false;
      });
      const boxes = blocks.map(pageBox);
      const crew = CREW[section.dataset.buildSection!] ?? CREW.intro;
      const t0 = performance.now() + 40;
      bench(crew, t0);
      const free = crew.map(() => t0);
      let end = t0;
      blocks.forEach((block, i) => {
        const w = i % crew.length;
        free[w] = buildBlock(block, boxes[i], cursors.get(crew[w])!, Math.max(free[w], t0 + i * 140));
        end = Math.max(end, free[w]);
      });
      crew.forEach((name, i) =>
        at(end + 60, (now) => {
          const c = cursors.get(name)!;
          move(c, (i % 2 ? innerWidth - 120 : 24) + scrollX, c.y + 30, now, 500);
        }),
      );
      at(end + 600, () => {
        if (queue.length) return next();
        busy = false;
        if (built.size === sections.length) finish();
      });
    }

    // Sections build once their top passes 65% of the screen.
    const io = new IntersectionObserver(
      safe((entries: IntersectionObserverEntry[]) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            request(entry.target as HTMLElement);
            io.unobserve(entry.target);
          }
      }),
      { rootMargin: "0px 0px -35% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    showCrew(CREW.intro);

    function finish() {
      if (done) return;
      done = true;
      jobs = [];
      tweens = [];
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      io.disconnect();
      window.removeEventListener("keydown", takeOver, { capture: true });
      window.removeEventListener("pointerdown", takeOver, { capture: true });
      for (const block of document.querySelectorAll<HTMLElement>("[data-build-block]")) block.dataset.built = "";
      host!.replaceChildren();
      host!.style.height = "";
      root.classList.remove(INTRO_CLASS);
      delete root.dataset.introClaimed;
      window.dispatchEvent(new Event(INTRO_END_EVENT));
      root.dataset.introLoop = "parked";
      try {
        sessionStorage.setItem(PLAYED_KEY, "1");
      } catch {
        /* Storage blocked: it may play again in this tab. */
      }
      setActive(false);
    }
    finishRef.current = finish;
    // Never in the way: a key or a press anywhere (the visitor wants to act,
    // say Tab to the search box) finishes the page at once. Scrolling does
    // not: it is what builds the next section.
    const takeOver = () => finish();
    window.addEventListener("keydown", takeOver, { capture: true });
    window.addEventListener("pointerdown", takeOver, { capture: true });
    // Claimed, once everything above is set up (the effect runs in one go, so
    // the pre-paint script's 3 s safety timer cannot fire half way): from here
    // the intro finishes the page. An error before this line leaves the claim
    // unset, and the timer shows the finished page.
    root.dataset.introClaimed = "";
    return () => {
      window.removeEventListener("keydown", takeOver, { capture: true });
      window.removeEventListener("pointerdown", takeOver, { capture: true });
      // Leaving /about mid-intro: nothing is left hidden or drawn.
      done = true;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      host.replaceChildren();
      host.style.height = "";
      root.classList.remove(INTRO_CLASS);
      delete root.dataset.introClaimed;
    };
  }, []);

  return (
    <>
      <div ref={layer} className={styles.layer} aria-hidden="true" data-intro-layer="" />
      {active && (
        <button type="button" className={styles.skip} onClick={() => finishRef.current()} data-intro-skip="">
          소개 건너뛰기
        </button>
      )}
    </>
  );
}
