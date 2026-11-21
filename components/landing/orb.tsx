"use client";

// The thinking orb, loaded after the first paint (#1866): thinking-orbs (~17KB gzip) was in the first JS of every
// page with an orb, the character page among them, though its canvas draws only in an effect anyway. Until the
// library is in, the orb's own still frame stands in its box (the frame it draws under reduced motion, generated at
// build time: orb-still-data), same size and display, so nothing moves when the canvas takes over.
import { useEffect, useState, type ComponentType } from "react";
import type { OrbState, ThinkingOrbProps } from "thinking-orbs";
import { useTheme } from "@/components/ui/theme-toggle";
import { useLandingMotion } from "./motion-context";
import { ORB_COLORS } from "./orb-colors";
import { OrbStill } from "./orb-still";

// The orb takes the site theme and our link blue for it (ORB_COLORS), so it never draws a light orb on a dark page.
export const orbColor = (theme: "light" | "dark") => ORB_COLORS[theme];

type OrbProps = ThinkingOrbProps & {
  theme: "light" | "dark";
  size: number;
  /** The theme is fixed by the caller (not the site's): the still frame keeps it too. */
  pinned?: boolean;
};

let Live: ComponentType<ThinkingOrbProps> | null = null;
let loading: Promise<ComponentType<ThinkingOrbProps>> | null = null;
const loadOrb = () =>
  (loading ??= import("thinking-orbs").then((mod) => {
    Live = mod.ThinkingOrb;
    return mod.ThinkingOrb;
  }));

/** ThinkingOrb once its library is in; its still frame before (the server's HTML, and a slow first load). */
export function Orb({ pinned, ...orb }: OrbProps) {
  const [Drawn, setDrawn] = useState<ComponentType<ThinkingOrbProps> | null>(() => Live);
  useEffect(() => {
    if (Drawn) return;
    let alive = true;
    void loadOrb().then((component) => alive && setDrawn(() => component));
    return () => {
      alive = false;
    };
  }, [Drawn]);
  if (Drawn) return <Drawn {...orb} />;
  // InlineOrb passes the site theme, which the server does not know: let the page theme pick the still's colour
  // there; a caller that pins a theme (the banner's light / dark pair) keeps it.
  return (
    <OrbStill
      size={orb.size}
      theme={pinned ? orb.theme : undefined}
      style={orb.style}
      aria-hidden={orb["aria-hidden"]}
      aria-label={orb["aria-label"]}
    />
  );
}

export function InlineOrb({ state = "searching" }: { state?: OrbState }) {
  const { enabled } = useLandingMotion();
  const theme = useTheme();
  return <Orb state={state} size={20} theme={theme} color={orbColor(theme)} paused={!enabled} aria-hidden="true" />;
}
