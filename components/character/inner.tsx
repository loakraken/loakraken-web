"use client";

import { useState } from "react";
import { AvatarCard, DetailTooltip, ItemTooltip } from "./item-tooltip";
import { useItemTooltips } from "./use-item-tooltips";
import { equipmentExtra } from "@/lib/character/item-tooltips";
import type { Character } from "@/lib/character/model";
import { groupEquipment } from "@/lib/character/detail";
import { avatarEffectTotals, avatarSlots } from "@/lib/character/inner";
import { safeGameImage } from "@/lib/character/model";
import { GameIcon } from "./imagery";
import { Panel } from "./panel";
import { Empty, number, text } from "./parts";
import styles from "./detail.module.css";

type Collectible = Character["collectibles"][number];

const ratio = (point: number | null, max: number | null) =>
  point != null && max ? Math.min(1, point / max) : 0;
const percentText = (point: number | null, max: number | null) =>
  point != null && max
    ? `${(Math.floor((point / max) * 1000) / 10).toLocaleString("ko-KR")}%`
    : "—";

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <span
      className={styles.progress}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      <i style={{ width: `${value * 100}%` }} />
    </span>
  );
}

/* 내실 ---------------------------------------------------------------------- */

const FILTERS = [
  { id: "all", label: "전체" },
  { id: "missing", label: "미획득" },
  { id: "done", label: "획득" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

function CollectionList({ collectible }: { collectible: Collectible }) {
  const [filter, setFilter] = useState<Filter>("all");
  const items = collectible.items.filter((item) => {
    const done = item.maxPoint != null && item.point === item.maxPoint;
    return filter === "all" || (filter === "done") === done;
  });
  const missing = collectible.items.filter(
    (item) => item.maxPoint == null || item.point !== item.maxPoint,
  ).length;
  return (
    <>
      <div className={styles.filterRow} role="group" aria-label="획득 상태">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
            {item.id === "missing" && ` ${missing}`}
          </button>
        ))}
      </div>
      {!collectible.items.length ? (
        <p className={styles.muted}>항목 목록이 제공되지 않았어요.</p>
      ) : !items.length ? (
        <p className={styles.muted}>
          {filter === "missing"
            ? `${text(collectible.type)}을(를) 모두 모았어요.`
            : "해당하는 항목이 없어요."}
        </p>
      ) : (
        <ol className={styles.collectionItems}>
          {items.map((item, i) => {
            const done = item.maxPoint != null && item.point === item.maxPoint;
            return (
              <li key={`${item.name}-${i}`} data-done={done || undefined}>
                <span>{text(item.name)}</span>
                <small>
                  {item.maxPoint != null && item.maxPoint > 1
                    ? `${number(item.point)} / ${number(item.maxPoint)}`
                    : done
                      ? "획득"
                      : "미획득"}
                </small>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

export function CollectiblesTab({ data }: { data: Character }) {
  const collectibles = data.collectibles;
  const [selected, setSelected] = useState(0);
  const current = collectibles[Math.min(selected, collectibles.length - 1)];
  const special = groupEquipment(data.loadout.equipment).others;
  const extra = useItemTooltips(data.characterName);
  // The reference also shows each kind's average, not only the overall share.
  const shares = collectibles
    .filter((item) => item.maxPoint)
    .map((item) => (item.point ?? 0) / (item.maxPoint ?? 1));
  const average = shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : null;
  const total = collectibles.reduce(
    (sum, item) => ({
      point: sum.point + (item.point ?? 0),
      max: sum.max + (item.maxPoint ?? 0),
    }),
    { point: 0, max: 0 },
  );
  return (
    <div className={styles.layout}>
      <div className={styles.columns}>
        <div className={styles.stack}>
          <Panel
            title="수집품"
            meta={
              collectibles.length
                ? `전체 ${percentText(total.point, total.max)}${average != null ? ` · 종류 평균 ${(average * 100).toFixed(2)}%` : ""}`
                : undefined
            }
          >
            {collectibles.length ? (
              <>
                <ul className={styles.collectionGrid}>
                  {collectibles.map((item, i) => (
                    <li key={`${item.type}-${i}`}>
                      <button
                        type="button"
                        aria-pressed={current === item}
                        onClick={() => setSelected(i)}
                      >
                        <span className={styles.collectionName}>
                          <GameIcon src={item.icon} size={32} />
                          <span>
                            <strong>{text(item.type)}</strong>
                            <small>
                              {number(item.point)} / {number(item.maxPoint)}
                            </small>
                          </span>
                        </span>
                        <b>{percentText(item.point, item.maxPoint)}</b>
                        <Bar
                          value={ratio(item.point, item.maxPoint)}
                          label={`${text(item.type)} 진행도`}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
                {current && (
                  <section
                    className={styles.collectionDetail}
                    aria-label={`${text(current.type)} 목록`}
                  >
                    <h3>{text(current.type)}</h3>
                    <CollectionList key={selected} collectible={current} />
                  </section>
                )}
              </>
            ) : (
              <Empty state={data.coverage.collectibles} />
            )}
          </Panel>
        </div>
        <aside className={styles.stack}>
          <Panel title="특수 장비">
            {special.length || data.decorations ? (
              <ul className={styles.itemList}>
                {special.map((item, i) => (
                  <li key={`${item.type}-${i}`} className={styles.item}>
                    <ItemTooltip
                      item={item}
                      slot={item.type ?? undefined}
                      extra={equipmentExtra(extra, data.loadout.equipment.indexOf(item), item.type)}
                    >
                      <GameIcon src={item.icon} grade={item.grade} size={36} />
                    </ItemTooltip>
                    <div className={styles.itemText}>
                      <strong>{text(item.type)}</strong>
                      <small>{text(item.name)}</small>
                    </div>
                  </li>
                ))}
                {data.decorations && (
                  <li className={styles.item}>
                    <div className={styles.itemText}>
                      <strong>문장</strong>
                      <small>
                        {data.decorations.emblems.length
                          ? data.decorations.emblems.join(", ")
                          : "없음"}
                        {data.decorations.symbol &&
                          ` · 심볼 ${data.decorations.symbol}`}
                      </small>
                    </div>
                  </li>
                )}
              </ul>
            ) : (
              <p className={styles.muted}>특수 장비가 제공되지 않았어요.</p>
            )}
          </Panel>
          <Panel title="성향">
            {data.tendencies.length ? (
              <dl className={styles.tendencies}>
                {data.tendencies.map((item, i) => (
                  <div key={`${item.type}-${i}`}>
                    <dt>{text(item.type)}</dt>
                    <dd>
                      {number(item.point)}
                      {item.maxPoint != null && <small> / {number(item.maxPoint)}</small>}
                    </dd>
                    <Bar
                      value={ratio(item.point, item.maxPoint)}
                      label={`${text(item.type)} 성향`}
                    />
                  </div>
                ))}
              </dl>
            ) : (
              <p className={styles.muted}>성향이 제공되지 않았어요.</p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/* 아바타 -------------------------------------------------------------------- */

export function AvatarsTab({ data }: { data: Character }) {
  const avatars = data.avatars;
  const totals = avatarEffectTotals(avatars);
  return (
    <div className={styles.layout}>
      <div className={styles.avatarColumns}>
        <Panel title="아바타 미리보기">
          <AvatarPreview url={data.imageUrl} name={data.characterName} />
        </Panel>
        <div className={styles.stack}>
          <Panel
            title="아바타 목록"
            meta={avatars.length ? `${avatars.length}개 장착` : undefined}
          >
            {avatars.length ? (
              <ul className={styles.avatarSlots}>
                {avatarSlots(avatars).map(({ slot, avatar }, i) => (
                  <li key={`${slot}-${i}`} data-empty={avatar ? undefined : true}>
                    {avatar ? (
                      <DetailTooltip name={avatar.name ?? "아바타"} card={<AvatarCard avatar={avatar} />}>
                        <GameIcon src={avatar.icon} grade={avatar.grade} size={36} />
                      </DetailTooltip>
                    ) : (
                      <span className={styles.avatarEmpty} aria-hidden="true" />
                    )}
                    <div className={styles.itemText}>
                      <small>{slot}</small>
                      <strong data-grade={avatar?.grade ?? undefined}>
                        {avatar ? text(avatar.name) : "-"}
                      </strong>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty state={data.coverage.avatars} />
            )}
            <p className={styles.caption}>
              염색 정보는 공식 전투정보실 응답에 없어 표시하지 않아요.
            </p>
          </Panel>
          <Panel title="아바타 효과">
            {totals.length ? (
              <dl className={styles.statGrid}>
                {totals.map((item) => (
                  <div key={item.name}>
                    <dt>{item.name}</dt>
                    <dd>+{item.value.toLocaleString("ko-KR")}%</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className={styles.muted}>합산할 효과가 없어요.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/**
 * The full-body render (the official profile image the banner uses, 612×708)
 * on a dark stage in every theme, as the game shows it. Lazy: it sits below
 * the banner, which already holds the same image.
 */
function AvatarPreview({ url, name }: { url: string | null; name: string }) {
  const safe = safeGameImage(url);
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.avatarStage}>
      {safe && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- official CDN render, not proxied
        <img
          src={safe}
          alt={`${name} 캐릭터 전신(장착한 아바타)`}
          width={612}
          height={708}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <p className={styles.avatarStageEmpty}>캐릭터 이미지를 불러오지 못했어요.</p>
      )}
    </div>
  );
}
