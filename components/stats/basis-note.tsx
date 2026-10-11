"use client";

import { Popover } from "@base-ui/react/popover";
import { InfoCircle } from "@/components/ui/icons";
import { pendingProps } from "@/lib/api/pending";
import { conditionsText, whole, type StatsMeta } from "@/lib/stats/model";
import styles from "./basis-note.module.css";

const kst = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export type Basis = {
  /** Characters the numbers are over; null when the response does not say. */
  population: number | null;
  conditions: StatsMeta["conditions"];
  aggregatedAt: string;
  minSample: number;
};

/**
 * How the ranks and statistics are made (user, 23:58): the official API has
 * no character list or ranks, so LOAKraken counts the characters it has seen
 * — not the game's population. Who is counted, as of when, and how to opt out.
 * Never names another site.
 */
function NoteBody({ basis }: { basis: Basis }) {
  return (
    <>
      <p className={styles.title}>이 순위와 통계는 이렇게 만들어요</p>
      <ul>
        <li>
          로스트아크 공식 API는 전체 캐릭터 목록과 순위를 주지 않아요. LOAKraken이 검색된 캐릭터와 그
          원정대 캐릭터를 모아 직접 계산해요.
        </li>
        <li>그래서 게임 전체 인구나 공식 순위가 아니라, LOAKraken이 확인한 캐릭터 안에서의 순위예요.</li>
        <li>
          집계 대상 {basis.population != null ? `${whole(basis.population)}명 · ` : ""}
          {conditionsText(basis.conditions)} · {kst.format(new Date(basis.aggregatedAt))} 기준. 표본이{" "}
          {basis.minSample}명 미만인 항목은 참고값으로 보여요.
        </li>
        <li>검색되는 캐릭터가 늘수록 집계 대상도 늘어나요.</li>
      </ul>
    </>
  );
}

/** Under a stats or rankings table: small gray text, always open. */
export function BasisNote({ basis, stale = false }: { basis: Basis; stale?: boolean }) {
  return (
    <section className={styles.note} aria-label="집계 기준 안내" {...pendingProps({ isPlaceholderData: stale })}>
      <NoteBody basis={basis} />
    </section>
  );
}

/** The same text behind a small ⓘ (the character rank panel). */
export function BasisInfo({ basis }: { basis: Basis }) {
  return (
    <Popover.Root>
      <Popover.Trigger className={styles.info} aria-label="집계 기준 안내">
        <InfoCircle size={16} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={12} className={styles.positioner}>
          <Popover.Popup className={`${styles.note} ${styles.popup}`}>
            <NoteBody basis={basis} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
