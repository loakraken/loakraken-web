import type { CSSProperties } from "react";
import { CLASS_GROUPS, groupColor, type ClassGroup } from "@/lib/stats/class-groups";
import styles from "./stats.module.css";

/**
 * The 직업군 colours named (user 11-08): over a list whose class bars take
 * their group's colour, so the colour is never the only way to tell the group.
 */
export function GroupLegend({ other = false }: { other?: boolean }) {
  // 기타 (a class the official groups do not hold yet) only when the list has one.
  const groups: ClassGroup[] = other ? [...CLASS_GROUPS, "기타"] : [...CLASS_GROUPS];
  return (
    <ul className={styles.legend} aria-label="직업군 색">
      {groups.map((group) => (
        <li key={group} className={styles.swatch} style={{ "--swatch": groupColor(group) } as CSSProperties}>
          {group}
        </li>
      ))}
    </ul>
  );
}
