"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { appliedStage, elementLabel, orderedSlots, sortCards } from "@/lib/character/card-collection";
import { CharacterQueryError, fetchCardCollection } from "@/lib/character/client";
import { CardArt } from "./imagery";
import { CardRefresh } from "./card-refresh";
import styles from "./card-collection.module.css";
import expand from "@/components/site/expand.module.css";
import { countdownText, retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { useCrossfade } from "@/lib/motion";
import { HelpInfo } from "@/components/stats/basis-note";
import { useTallest } from "@/components/ui/use-tallest";

/**
 * Roster card records (F-6), inside the cards panel right under the equipped
 * set: six element slots for the character's role, then the 도감 and
 * buildable set effects, folded.
 */
export function CardCollection({ name }: { name: string }) {
  const query = useQuery({
    queryKey: ["card-collection", name],
    queryFn: ({ signal }) => fetchCardCollection(name, signal),
    staleTime: 5 * 60_000,
  });
  const fade = useCrossfade(query.isPending);
  const data = query.data?.data;
  // Default to the character's role; either set list can be viewed.
  const [role, setRole] = useState<"dealer" | "supporter" | null>(null);
  const limit = useRateLimit(query.error);
  const shown = role ?? (data?.position === "SUPPORT" ? "supporter" : "dealer");
  // The other set kind is drawn anew (its names start elsewhere) in the
  // tallest kind's room, so the fold under it stays put (A7).
  const [slotsRef, slotsHeight] = useTallest();

  return (
    <section className={styles.collection} aria-labelledby={`card-record-${name}`}>
      <header className={styles.head}>
        <h3 id={`card-record-${name}`}>원정대 카드 기록</h3>
        {/* 도움말 (character screen checklist: 카드 도움말 팝오버). */}
        <HelpInfo label="원정대 카드 기록 도움말" title="원정대 카드 기록">
          <ul>
            <li>같은 서버 원정대 캐릭터가 카드를 장착한 채 검색되면, 속성별 세트마다 가장 높은 각성을 기록해요.</li>
            <li>딜러 세트와 서포터 세트를 따로 볼 수 있어요. 처음에는 이 캐릭터의 포지션 쪽을 보여 드려요.</li>
            <li>&lsquo;기록 채우기&rsquo;를 누르면 원정대 캐릭터를 차례로 조회해 기록을 채워요.</li>
            <li>도감은 기록된 카드별 최고 각성이고, 구성 가능한 세트는 기록된 카드로 맞출 수 있는 세트 효과예요.</li>
          </ul>
        </HelpInfo>
        {/* Both are there from the first frame (the count blank, the kinds
            not pressable yet), so the head does not grow when the records
            land and push the refill line down (A7). */}
        <span className={styles.count}>
          {data ? `원정대 ${data.rosterCharacters}명 중 ${data.observedCharacters}명 기록` : "\u00a0"}
        </span>
        <span className={styles.roles} role="group" aria-label="세트 종류">
          {(["dealer", "supporter"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={shown === value}
              disabled={!data}
              onClick={() => setRole(value)}
            >
              {value === "dealer" ? "딜러" : "서포터"}
            </button>
          ))}
        </span>
      </header>
      <CardRefresh name={name} />
      {query.isPending ? (
        <p className={styles.muted}>카드 기록을 불러오고 있어요…</p>
      ) : !data ? (
        <div className={styles.muted}>
          <p>
            {limit.limited
              ? countdownText(limit.seconds)
              : query.error instanceof CharacterQueryError &&
                  query.error.info.code === "CARD_COLLECTION_DISABLED"
                ? "카드 기록 기능이 꺼져 있어요."
                : "카드 기록을 불러오지 못했어요."}
          </p>
          <button
            type="button"
            className={styles.retry}
            onClick={() => query.refetch()}
            disabled={limit.seconds > 0}
          >
            {retryLabel(limit.seconds)}
          </button>
        </div>
      ) : (
        <>
          <div ref={slotsRef} style={slotsHeight ? { minHeight: slotsHeight } : undefined}>
            <ul key={shown} ref={fade} className={styles.elements}>
              {orderedSlots(data.elementRecords[shown]).map((slot, i) => {
                const stage = slot.record ? appliedStage(slot.record) : null;
                return (
                  <li
                    key={`${slot.element}-${i}`}
                    data-recorded={slot.record ? "" : undefined}
                    title={slot.setName}
                  >
                    <span className={styles.slotHead}>
                      <i data-element={slot.element}>{elementLabel(slot.element)}</i>
                      <span className={styles.setName}>{slot.setName}</span>
                    </span>
                    {slot.record ? (
                      <span className={styles.value}>
                        <b>{slot.record.awakening}각성</b>
                        {stage != null && <small>{stage}각 효과 적용</small>}
                        <small className={styles.by}>{slot.record.recordedBy}</small>
                      </span>
                    ) : (
                      <span className={styles.none}>미기록</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          {data.observedCharacters === 0 && (
            <p className={styles.note}>
              원정대 캐릭터가 카드를 장착한 채 한 번이라도 검색되면 기록돼요.
            </p>
          )}
          {data.cards.length > 0 && (
            <details className={`${styles.fold} ${expand.expand}`}>
              <summary>
                도감 <span>{data.cards.length}장</span>
              </summary>
              <ul className={styles.cards}>
                {sortCards(data.cards).map((card) => (
                  <li key={card.name}>
                    <CardArt
                      src={card.icon}
                      name={card.name}
                      grade={card.grade}
                      awakeCount={card.awakeCount}
                      awakeTotal={card.awakeTotal}
                    />
                  </li>
                ))}
              </ul>
            </details>
          )}
          {data.sets.length > 0 && (
            <details className={`${styles.fold} ${expand.expand}`}>
              <summary>
                구성 가능한 세트 <span>{data.sets.length}개</span>
              </summary>
              <ul className={styles.sets}>
                {data.sets.map((set) => {
                  const stage = appliedStage(set);
                  return (
                    <li key={set.setName}>
                      <header>
                        <strong>{set.setName}</strong>
                        <span>
                          {set.cardCount}장 · {set.awakening}각성
                          {stage != null && ` (${stage}각 효과 적용)`}
                        </span>
                      </header>
                      <ul>
                        {set.effects.map((effect) => (
                          <li
                            key={`${effect.pieces}-${effect.awakening}`}
                            data-active={effect.active || undefined}
                          >
                            <b>
                              {effect.pieces}세트
                              {effect.awakening > 0 && ` ${effect.awakening}각`}
                            </b>
                            {effect.description}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
          <p className={styles.note}>
            LOAKraken에서 검색된 원정대 캐릭터의 장착 카드를 기록해요. 이후 각성을
            올렸다면 그 캐릭터를 다시 검색하면 갱신돼요.
          </p>
        </>
      )}
    </section>
  );
}
