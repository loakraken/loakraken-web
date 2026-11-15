// The loading orb's colours: our link blue (--link) per theme, so the orb never draws a light orb on a dark page.
// One source for the live orb (orb.tsx) and the still frame's generator (scripts/gen-orb-still.mjs, which imports
// this file directly — keep it plain, erasable TypeScript), so a tint change reaches both (codex #1647 P3).
export const ORB_COLORS = { light: "#0066cc", dark: "#4da3ff" } as const;
