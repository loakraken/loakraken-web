"use client";

import { useRouter } from "next/navigation";
import { PillTab, PillTabs } from "@/components/ui/pill-tabs";
import styles from "./stats.module.css";

const TYPES = [
  { id: "character", label: "캐릭터" },
  { id: "roster", label: "원정대" },
  { id: "collectibles", label: "수집품" },
  { id: "bracelets", label: "팔찌" },
  { id: "gems", label: "젬" },
] as const;
export type RankingType = (typeof TYPES)[number]["id"];

/**
 * Which ranking: characters, rosters, collectibles, bracelets or gems (only the ones whose
 * flags are on), with the same pill tabs as the stats
 * screen. Switching starts the other ranking with its default conditions
 * (each keeps its own filters in the address).
 */
export function RankingTypeTabs({ value, types }: { value: RankingType; types: readonly RankingType[] }) {
  const router = useRouter();
  return (
    <PillTabs
      aria-label="랭킹 종류"
      listClassName={styles.tabs}
      value={value}
      onValueChange={(next) => router.replace(next === "character" ? "?" : `?type=${next}`, { scroll: false })}
    >
      {TYPES.filter((type) => types.includes(type.id)).map((type) => (
        <PillTab key={type.id} value={type.id}>
          {type.label}
        </PillTab>
      ))}
    </PillTabs>
  );
}
