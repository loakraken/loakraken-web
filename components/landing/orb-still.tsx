// The orb's still frame as server-drawn SVG (#1632). On a direct load the character loading screen is
// the server's fallback for a page still on its way, and React does not hydrate a fallback: the
// canvas orb (drawn in an effect) stayed blank through the whole wait. This draws the same frame the
// orb shows under reduced motion (t = 0.6) with the package's own preset, frame and paint, painted
// through a context that only records, so it needs no script to be seen.
import type { CSSProperties } from "react";
import { MODE_FRAMES, paintFrame, resolvePreset } from "thinking-orbs/engine";
import { orbColor } from "./orb";

const SIZE = 64;
const STILL_T = 0.6;

type Dot = { x: number; y: number; r: number; fill: string };

const tint = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

function record(dark: boolean): Dot[] {
  const { mode, opts } = resolvePreset("searching", SIZE);
  const frame = MODE_FRAMES[mode](SIZE, STILL_T, opts);
  const dots: Dot[] = [];
  let fill = "";
  let at = { x: 0, y: 0, r: 0 };
  // Only what paint() uses for dots; the searching orb draws no lines.
  const ctx = {
    set fillStyle(value: string) {
      fill = value;
    },
    set strokeStyle(_: string) {},
    set lineWidth(_: number) {},
    beginPath() {},
    arc(x: number, y: number, r: number) {
      at = { x, y, r };
    },
    fill() {
      dots.push({ ...at, fill });
    },
    moveTo() {},
    lineTo() {},
    stroke() {},
  } as unknown as CanvasRenderingContext2D;
  paintFrame(ctx, frame, dark, tint(orbColor(dark ? "dark" : "light")));
  return dots;
}

// Colours rounded to 16 steps and alpha to 0.05 (≤ 8/255 off on dots 0.3–2px across): ~40 groups
// instead of one per dot, so the stand-in is a few KB of HTML.
const round = (rgba: string) => {
  const [r, g, b, a] = (rgba.match(/[\d.]+/g) ?? []).map(Number);
  const c = (v: number) => Math.min(255, Math.round(v / 16) * 16);
  return `rgba(${c(r)},${c(g)},${c(b)},${Math.round(a * 20) / 20})`;
};

/** Dots grouped by their light and dark colour; positions are the same in both themes. */
const GROUPS: { light: string; dark: string; dots: string }[] = (() => {
  const light = record(false);
  const dark = record(true);
  const groups = new Map<string, { light: string; dark: string; dots: string[] }>();
  light.forEach((dot, i) => {
    const key = `${round(dot.fill)}|${round(dark[i].fill)}`;
    const group = groups.get(key) ?? { light: round(dot.fill), dark: round(dark[i].fill), dots: [] };
    group.dots.push(`M${dot.x.toFixed(1)} ${dot.y.toFixed(1)}m-${dot.r.toFixed(1)} 0a${dot.r.toFixed(1)} ${dot.r.toFixed(1)} 0 1 0 ${(dot.r * 2).toFixed(1)} 0a${dot.r.toFixed(1)} ${dot.r.toFixed(1)} 0 1 0 -${(dot.r * 2).toFixed(1)} 0`);
    groups.set(key, group);
  });
  return [...groups.values()].map((group) => ({ ...group, dots: group.dots.join("") }));
})();

/** The orb's still frame, filling its 64×64 box; the page theme (data-theme on <html>) picks the colours. */
export function OrbStill({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true" focusable="false">
      {GROUPS.map((group) => (
        <path key={`${group.light}|${group.dark}`} d={group.dots} style={{ "--orb-l": group.light, "--orb-d": group.dark } as CSSProperties} />
      ))}
    </svg>
  );
}
