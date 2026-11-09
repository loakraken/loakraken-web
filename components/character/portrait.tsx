import type { ComponentPropsWithRef } from "react";
import styles from "./portrait.module.css";

/** Where the render is shown: how far each side fades (portrait.module.css). */
export type PortraitFade = "card" | "banner" | "stage";

/**
 * The official character render with soft edges, shared by every place that
 * shows it (the rankings podium, the character banner, the avatar tab), so
 * effects that reach the canvas edge fade into the stage instead of stopping
 * at a straight line. A plain <img> otherwise: the caller gives its source,
 * size, loading and handlers, and places it.
 */
export function CharacterPortrait({ fade, className, ...img }: ComponentPropsWithRef<"img"> & { fade: PortraitFade }) {
  return (
    // Official CDN render, hotlinked and not proxied (the Next optimizer would proxy a third-party host).
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- alt comes from the caller
    <img {...img} className={className ? `${styles.portrait} ${className}` : styles.portrait} data-fade={fade} referrerPolicy="no-referrer" />
  );
}
