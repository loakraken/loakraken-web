"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ELEMENT_LABEL,
  slotsFor,
  sortCards,
} from "@/lib/character/card-collection";
import { CharacterQueryError, fetchCardCollection } from "@/lib/character/client";
import { CardArt } from "./imagery";
import { Panel } from "./panel";
import styles from "./card-collection.module.css";

/**
 * Roster card records (F-6): ILOA's six element slots for the character's
 * role, then LOAWA's 도감 and buildable set effects, folded.
 */
export function CardCollectionPanel({ name }: { name: string }) {
  const query = useQuery({
    queryKey: ["card-collection", name],
    queryFn: ({ signal }) => fetchCardCollection(name, signal),
    staleTime: 5 * 60_000,
  });
  const data = query.data?.data;
  const meta = data
    ? `원정대 ${data.rosterCharacters}명 중 ${data.observedCharacters}명 기록`
    : undefined;

  return (
    <Panel title="원정대 카드 기록" meta={meta}>
      {query.isPending ? (
        <p className={styles.muted}>카드 기록을 불러오고 있어요…</p>
      ) : !data ? (
        <div className={styles.muted}>
          <p>
            {query.error instanceof CharacterQueryError &&
            query.error.info.code === "CARD_COLLECTION_DISABLED"
              ? "카드 기록 기능이 꺼져 있어요."
              : "카드 기록을 불러오지 못했어요."}
          </p>
          <button type="button" className={styles.retry} onClick={() => query.refetch()}>
            다시 시도
          </button>
        </div>
      ) : (
        <>
          <ul className={styles.elements}>
            {slotsFor(data).map((slot) => (
              <li
                key={slot.element}
                data-recorded={slot.record ? "" : undefined}
                title={
                  slot.record?.recordedBy
                    ? `${slot.setName} · ${slot.record.recordedBy}에서 기록`
                    : slot.setName
                }
              >
                <i data-element={slot.element}>{ELEMENT_LABEL[slot.element]}</i>
                <span className={styles.setName}>{slot.setName}</span>
                {slot.record ? (
                  <b>
                    {slot.record.activeAwakening}각성
                    {slot.record.awakening > slot.record.activeAwakening && (
                      <small> ({slot.record.awakening})</small>
                    )}
                  </b>
                ) : (
                  <span className={styles.none}>미기록</span>
                )}
              </li>
            ))}
          </ul>
          {data.observedCharacters === 0 && (
            <p className={styles.note}>
              원정대 캐릭터가 카드를 장착한 채 한 번이라도 검색되면 기록돼요.
            </p>
          )}
          {data.cards.length > 0 && (
            <details className={styles.fold}>
              <summary>
                도감 <span>{data.cards.length}장</span>
              </summary>
              <ul className={styles.cards}>
                {sortCards(data.cards).map((card) => (
                  <li key={card.name} title={card.recordedBy ? `${card.recordedBy}에서 기록` : undefined}>
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
            <details className={styles.fold}>
              <summary>
                구성 가능한 세트 <span>{data.sets.length}개</span>
              </summary>
              <ul className={styles.sets}>
                {data.sets.map((set) => (
                  <li key={set.setName}>
                    <header>
                      <strong>{set.setName}</strong>
                      <span>
                        {set.cardCount}장 · {set.activeAwakening}각성
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
                ))}
              </ul>
            </details>
          )}
          <p className={styles.note}>
            LOAKraken에서 검색된 원정대 캐릭터의 장착 카드를 기록해요. 이후 각성을
            올렸다면 그 캐릭터를 다시 검색하면 갱신돼요.
          </p>
        </>
      )}
    </Panel>
  );
}
