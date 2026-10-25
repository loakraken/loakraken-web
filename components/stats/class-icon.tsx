import type { CSSProperties } from "react";
import { classChip, classIconUrl } from "@/lib/stats/class-icons";
import styles from "./class-icon.module.css";

/**
 * The class's official icon in a fixed box (no layout shift), tinted with the
 * text colour through a CSS mask so it follows the theme. Decorative: the
 * class name is always written next to it, so screen readers skip it. A class
 * without a known icon shows its first two letters instead.
 */
export function ClassIcon({ name, size = 24 }: { name: string; size?: number }) {
  const url = classIconUrl(name);
  const box = { "--size": `${size}px` } as CSSProperties;
  if (!url)
    return (
      <span className={`${styles.icon} ${styles.chip}`} style={box} aria-hidden="true">
        {classChip(name)}
      </span>
    );
  return (
    <span
      className={styles.icon}
      style={{ ...box, "--icon": `url("${url}")` } as CSSProperties}
      aria-hidden="true"
    />
  );
}
