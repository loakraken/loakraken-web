"use client";

// The thinking orb, loaded after the first paint (#1867): thinking-orbs (~17KB gzip) was in the first JS of every
// page with an orb, the character page among them, though its canvas draws only in an effect anyway. Until the
// library is in, the orb's own still frame stands in its box (the frame it draws under reduced motion, generated at
// build time: orb-still-data), same size and display, so nothing moves when the canvas takes over.
import { Component, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
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
// A failed load is not kept: the next Orb to mount asks again (codex P3 on #1871).
const loadOrb = () =>
  (loading ??= import("thinking-orbs")
    .then((mod) => {
      Live = mod.ThinkingOrb;
      return mod.ThinkingOrb;
    })
    .catch((error) => {
      loading = null;
      throw error;
    }));

/** A canvas that has drawn something (any pixel with alpha). Null context or a cross-origin taint: not yet. */
function inked(canvas: HTMLCanvasElement | null | undefined) {
  if (!canvas?.width || !canvas.height) return false;
  try {
    const data = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!data) return false;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
  } catch {
    // unreadable: keep the still
  }
  return false;
}

/** The still, not the library's canvas, when the orb throws while rendering. */
class OrbFallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** ThinkingOrb once its library is in; its still frame before (the server's HTML, and a slow first load). */
export function Orb({ pinned, ...orb }: OrbProps) {
  const [Drawn, setDrawn] = useState<ComponentType<ThinkingOrbProps> | null>(() => Live);
  useEffect(() => {
    if (Drawn) return;
    let alive = true;
    loadOrb().then(
      (component) => alive && setDrawn(() => component),
      () => {}, // the still stays; a later mount tries again
    );
    return () => {
      alive = false;
    };
  }, [Drawn]);
  // The canvas takes over only once it has drawn a frame (codex P3 on #1871): a null 2D context or a drawing error
  // leaves the still in the box rather than an empty one. Checked for about two seconds of frames.
  const box = useRef<HTMLSpanElement>(null);
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    if (!Drawn || painted) return;
    let frames = 0;
    let id = 0;
    const check = () => {
      if (inked(box.current?.querySelector("canvas"))) setPainted(true);
      else if (++frames < 120) id = requestAnimationFrame(check);
    };
    id = requestAnimationFrame(check);
    return () => cancelAnimationFrame(id);
  }, [Drawn, painted]);
  // After its first frame the library draws in its own requestAnimationFrame loop, outside React's error boundary
  // (codex P3 on #1873): a frame clears the canvas before it draws, so a throw there leaves it empty and the loop
  // stopped. Any uncaught error on the page makes a painted orb look at its canvas once; an empty one hands the box
  // back to the still. Nothing runs while nothing throws.
  const [blank, setBlank] = useState(false);
  useEffect(() => {
    if (!painted || blank) return;
    const onError = () => {
      if (!inked(box.current?.querySelector("canvas"))) setBlank(true);
    };
    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  }, [painted, blank]);
  // InlineOrb passes the site theme, which the server does not know: let the page theme pick the still's colour
  // there; a caller that pins a theme (the banner's light / dark pair) keeps it.
  const still = (over: boolean) => (
    <OrbStill
      size={orb.size}
      theme={pinned ? orb.theme : undefined}
      style={over ? { position: "absolute", inset: 0 } : orb.style}
      aria-hidden={over ? true : orb["aria-hidden"]}
      aria-label={over ? undefined : orb["aria-label"]}
    />
  );
  if (!Drawn || blank) return still(false);
  return (
    <span ref={box} style={{ position: "relative", display: "block", width: orb.size, height: orb.size, ...orb.style }}>
      <OrbFallback fallback={still(false)}>
        <Drawn {...orb} style={undefined} />
      </OrbFallback>
      {!painted && still(true)}
    </span>
  );
}

export function InlineOrb({ state = "searching" }: { state?: OrbState }) {
  const { enabled } = useLandingMotion();
  const theme = useTheme();
  return <Orb state={state} size={20} theme={theme} color={orbColor(theme)} paused={!enabled} aria-hidden="true" />;
}
