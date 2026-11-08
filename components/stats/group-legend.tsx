import type { CSSProperties } from "react";
import { CLASS_GROUPS, groupColor } from "@/lib/stats/class-groups";
import styles from "./stats.module.css";

/**
 * The 직업군 colours named (user 11-08): over a list whose class bars take
 * their group's colour, so the colour is never the only way to tell the group.
 */
export function GroupLegend() {
  return (
    <ul className={styles.legend} aria-label="직업군 색">
      {CLASS_GROUPS.map((group) => (
        <li key={group} className={styles.swatch} style={{ "--swatch": groupColor(group) } as CSSProperties}>
          {group}
        </li>
      ))}
    </ul>
  );
}
