import { useSyncExternalStore, type CSSProperties } from "react";

const CROSSFADE = { "--reveal-distance": "0px" } as CSSProperties;
const noop = () => () => {};

/**
 * Loading → content (motion guide 7.2): content that mounts on the client after
 * a placeholder fades in where the placeholder stood, with no travel, so
 * nothing jumps. Content already in the server HTML does not fade: during
 * hydration this returns the plain class, and adding "k-reveal" (#186) to an
 * element that is already painted plays nothing. Reduced motion shows it at
 * once. Usage: `const fade = useCrossfade();` then `<ul {...fade(styles.rows)}>`.
 */
export function useCrossfade() {
  const client = useSyncExternalStore(noop, () => true, () => false);
  return (className?: string) =>
    client
      ? { className: className ? `${className} k-reveal` : "k-reveal", style: CROSSFADE }
      : { className };
}
