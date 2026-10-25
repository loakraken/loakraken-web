"use client";

import { useState } from "react";
import { classChip, classIconUrl } from "@/lib/stats/class-icons";
import styles from "./class-icon.module.css";

/**
 * The class's official icon in a fixed box (no layout shift). An <img>, not a
 * CSS mask: the official files are 3–20 KB each, uncompressed, and a mask
 * loads even off-screen, while an image waits until its row is near
 * (loading="lazy"). The files are black, so dark themes invert them.
 * Decorative: the class name is always written next to it. A class without a
 * known icon, or an icon that fails to load, shows its first two letters.
 */
export function ClassIcon({ name, size = 24 }: { name: string; size?: number }) {
  const url = classIconUrl(name);
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (!url || failed)
    return (
      <span className={styles.chip} style={box} aria-hidden="true">
        {classChip(name)}
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- official CDN icon, hotlinked at a fixed size
    <img
      className={styles.icon}
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
