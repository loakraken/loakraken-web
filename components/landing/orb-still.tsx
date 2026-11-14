// The orb's still frame as server-drawn SVG (#1632). On a direct load the character loading screen is
// the server's fallback for a page still on its way, and React does not hydrate a fallback: the
// canvas orb (drawn in an effect) stayed blank through the whole wait. This shows the frame the orb
// draws under reduced motion, from data generated at build time (scripts/gen-orb-still.mjs, codex
// #1633 P3): no client computes it. Each dot is a round-capped stroke a hair long, so a group of dots
// is one path; the page theme (data-theme on <html>) picks the light or dark colour.
import type { CSSProperties } from "react";
import { ORB_STILL, ORB_STILL_SIZE } from "./orb-still-data";

/** The orb's still frame, filling its 64×64 box. */
export function OrbStill({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${ORB_STILL_SIZE} ${ORB_STILL_SIZE}`}
      width={ORB_STILL_SIZE}
      height={ORB_STILL_SIZE}
      aria-hidden="true"
      focusable="false"
    >
      {ORB_STILL.map((group) => (
        <path
          key={`${group.light}|${group.dark}|${group.width}`}
          d={group.d}
          strokeWidth={group.width}
          style={{ "--orb-l": group.light, "--orb-d": group.dark } as CSSProperties}
        />
      ))}
    </svg>
  );
}
