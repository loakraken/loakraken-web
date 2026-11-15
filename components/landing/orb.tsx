"use client";

import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { useTheme } from "@/components/ui/theme-toggle";
import { useLandingMotion } from "./motion-context";
import { ORB_COLORS } from "./orb-colors";

// The orb takes the site theme and our link blue for it (ORB_COLORS), so it never draws a light orb on a dark page.
export const orbColor = (theme: "light" | "dark") => ORB_COLORS[theme];

export function InlineOrb({ state = "searching" }: { state?: OrbState }) {
  const { enabled } = useLandingMotion();
  const theme = useTheme();
  return <ThinkingOrb state={state} size={20} theme={theme} color={orbColor(theme)} paused={!enabled} aria-hidden="true" />;
}
