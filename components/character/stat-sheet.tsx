"use client";

import { Dialog } from "@base-ui/react/dialog";
import { CloseCircle } from "@/components/ui/icons";
import { COMBAT_STATS } from "@/lib/character/detail";
import type { Character } from "@/lib/character/model";
import { number, numeric } from "./parts";
import styles from "./detail.module.css";

type Stat = Character["stats"][number];

function StatCard({ stat }: { stat: Stat }) {
  return (
    <li className={styles.statCard}>
      <p>
        <strong>{stat.type}</strong>
        <b>{numeric(stat.value)}</b>
      </p>
      {stat.tooltip.map((line, i) => (
        <span key={i}>{line}</span>
      ))}
    </li>
  );
}

/**
 * 특성 자세히 (character screen checklist §14.1 ④): the stat total, the two
 * basic stats and the six combat stats, each as a card with the official
 * tooltip lines under its value. A centred sheet on wide screens, a bottom
 * sheet on phones; Esc, the close button or a press outside closes it.
 */
export function StatSheet({ stats, total }: { stats: Character["stats"]; total: number }) {
  const basic = ["공격력", "최대 생명력"]
    .map((type) => stats.find((stat) => stat.type === type))
    .filter((stat): stat is Stat => Boolean(stat));
  const combat = COMBAT_STATS.map((type) => stats.find((stat) => stat.type === type)).filter(
    (stat): stat is Stat => Boolean(stat),
  );
  return (
    <Dialog.Root>
      <Dialog.Trigger className={styles.statMore}>특성 자세히</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.sheetBackdrop} />
        <Dialog.Popup className={styles.statSheet}>
          <header>
            <Dialog.Title>특성</Dialog.Title>
            <Dialog.Close className={styles.sheetClose} aria-label="닫기">
              <CloseCircle size={20} aria-hidden="true" />
            </Dialog.Close>
          </header>
          <p className={styles.statTotal}>
            특성합 <b>{number(total)}</b>
          </p>
          {basic.length > 0 && (
            <section aria-label="기본 특성">
              <h3>기본 특성</h3>
              <ul>
                {basic.map((stat) => (
                  <StatCard key={stat.type} stat={stat} />
                ))}
              </ul>
            </section>
          )}
          {combat.length > 0 && (
            <section aria-label="전투 특성">
              <h3>전투 특성</h3>
              <ul>
                {combat.map((stat) => (
                  <StatCard key={stat.type} stat={stat} />
                ))}
              </ul>
            </section>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
