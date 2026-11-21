// The orb's still frame as server-drawn SVG (#1632): the frame the orb draws under reduced motion, from data
// generated at build time (scripts/gen-orb-still.mjs, codex #1633 P3). Each dot is a round-capped stroke a hair
// long, so a group of dots is one path. The page theme (data-theme on <html>, set before the first paint) picks the
// light or dark colour (globals.css .orb-still), so the server's HTML is right in a dark page too; `theme` pins one
// where the caller draws both and shows one by CSS (the banner). It also stands in the canvas's box while
// thinking-orbs loads (Orb, #1867): display block, size × size.
import type { CSSProperties } from "react";
import { ORB_STILL, ORB_STILL_SIZE } from "./orb-still-data";

export function OrbStill({
  size = ORB_STILL_SIZE,
  theme,
  className,
  style,
  "aria-hidden": hidden,
  "aria-label": label,
}: {
  size?: number;
  theme?: "light" | "dark";
  className?: string;
  style?: CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
}) {
  return (
    <svg
      className={className ? `orb-still ${className}` : "orb-still"}
      data-orb-theme={theme}
      viewBox={`0 0 ${ORB_STILL_SIZE} ${ORB_STILL_SIZE}`}
      width={size}
      height={size}
      style={{ display: "block", width: size, height: size, ...style }}
      focusable="false"
      {...(hidden === true || hidden === "true" ? { "aria-hidden": true } : label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
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
