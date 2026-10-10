"use client";

import { memo, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, Info, RefreshCw, Share2, Star } from "lucide-react";
import { InlineOrb } from "@/components/landing/orb";
import { Reveal } from "@/components/landing/motion";
import {
  ARK_TREES,
  COMBAT_STATS,
  GRADE_LABEL,
  SLOT_LABEL,
  averageQuality,
  gemBaseAttack,
  gemKind,
  engravingBookString,
  groupEquipment,
  isGrade,
  parsePassiveNode,
  qualityTier,
  refreshWindow,
  relativeAgo,
  remainingLabel,
  skillSummary,
  statNumber,
  stoneBonus,
  type Equipment,
  type Skill,
} from "@/lib/character/detail";
import {
  characterNameError,
  coverageLabel,
  normalizeCharacterName,
  type Character,
  type CharacterEnvelope,
} from "@/lib/character/model";
import {
  CharacterQueryError,
  fetchHistory,
  fetchSiblings,
  fetchTitles,
} from "@/lib/character/client";
import { METRICS, change, stepSeries } from "@/lib/character/history";
import { failureCopy } from "@/lib/character/model";
import { HistoryChart } from "./history-chart";
import { AvatarsTab, CollectiblesTab } from "./inner";
import { Panel } from "./panel";
import { ViewsPanel } from "./views-panel";
import { useTabPill } from "./tab-pill";
import { ItemTooltip } from "./item-tooltip";
import { ReceiptPanel } from "./receipt-panel";
import { useStagger } from "./entrance";
import { RankPanel } from "./rank-panel";
import { byObservedOrder, groupByDay } from "@/lib/character/titles";
import { CardCollection } from "./card-collection-panel";
import { CardArt, GameIcon } from "./imagery";
import {
  Empty,
  Evidence,
  SourceText,
  kstTime,
  level,
  number,
  numeric,
  text,
} from "./parts";
import styles from "./detail.module.css";
import expand from "@/components/site/expand.module.css";
import { rateLimitCopy, retryLabel } from "@/lib/api/rate-limit";
import { RateLimitNote } from "@/components/site/rate-limit-note";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { useCrossfade } from "@/lib/motion";

export const TABS = [
  { id: "combat", label: "전투" },
  { id: "skills", label: "스킬" },
  { id: "arkpassive", label: "아크 패시브" },
  { id: "collectibles", label: "내실" },
  { id: "avatars", label: "아바타" },
  { id: "stats", label: "통계" },
  { id: "siblings", label: "원정대" },
  { id: "evidence", label: "세팅 점검" },
] as const;
export type TabId = (typeof TABS)[number]["id"];
export const tabOf = (value: string | null): TabId =>
  TABS.some((tab) => tab.id === value) ? (value as TabId) : "combat";

/* Favourites (per browser) -------------------------------------------------- */

const FAVORITES = "loakraken:favorites";
const favoriteEvent = "loakraken:favorites";
function readFavorites(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
const subscribeFavorites = (callback: () => void) => {
  window.addEventListener(favoriteEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(favoriteEvent, callback);
    window.removeEventListener("storage", callback);
  };
};
function useFavorite(name: string) {
  const favorite = useSyncExternalStore(
    subscribeFavorites,
    () => readFavorites().includes(name),
    () => false,
  );
  const toggle = () => {
    try {
      const list = readFavorites().filter((item) => item !== name);
      localStorage.setItem(
        FAVORITES,
        JSON.stringify(favorite ? list : [name, ...list].slice(0, 30)),
      );
      window.dispatchEvent(new Event(favoriteEvent));
    } catch {
      /* Storage blocked: the toggle simply does not persist. */
    }
  };
  return [favorite, toggle] as const;
}

/* Tab bar ------------------------------------------------------------------- */

export function TabBar({
  name,
  tab,
  data,
  now,
  fetching,
  rateLimitSeconds,
  onRefresh,
}: {
  name: string;
  tab: TabId;
  data: Character;
  now: number;
  fetching: boolean;
  rateLimitSeconds: number;
  onRefresh: () => void;
}) {
  const [favorite, toggleFavorite] = useFavorite(name);
  const [shareStatus, setShareStatus] = useState("");
  const { nav: pillNav, layer: pillLayer, onKeyDown: pillKey, onPointerDown: pillPointer } = useTabPill(tab);
  const window_ = refreshWindow(data, now);
  const cooling = window_.remainingMs > 0;
  const disabled = fetching || cooling || rateLimitSeconds > 0;
  const tooltipId = "refresh-tooltip";

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches)
        await navigator.share({ title: `${name} | LOAKraken`, url });
      else {
        await navigator.clipboard.writeText(url);
        setShareStatus("링크를 복사했어요.");
      }
    } catch {
      setShareStatus("링크를 복사하지 못했어요. 주소창에서 복사해 주세요.");
    }
    setTimeout(() => setShareStatus(""), 2500);
  }

  return (
    <div className={styles.tabBar}>
      <div className={styles.tabInner}>
        <nav
          ref={pillNav}
          className={styles.tabs}
          aria-label="캐릭터 정보 탭"
          onKeyDown={pillKey}
          onPointerDown={pillPointer}
        >
          {TABS.map((item) => (
            <Link
              key={item.id}
              href={item.id === "combat" ? "?" : `?tab=${item.id}`}
              replace
              scroll={false}
              aria-current={tab === item.id ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          {/* The selected style, clipped to the current tab (tab-pill.ts). */}
          <span ref={pillLayer} className={styles.pillLayer} aria-hidden="true">
            {TABS.map((item) => (
              <span key={item.id} data-current={tab === item.id || undefined}>
                {item.label}
              </span>
            ))}
          </span>
        </nav>
        <div className={styles.tabActions}>
          <button
            type="button"
            className={styles.iconAction}
            onClick={share}
            aria-label="공유하기"
          >
            <Share2 size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.iconAction}
            onClick={toggleFavorite}
            aria-pressed={favorite}
            aria-label={favorite ? "즐겨찾기 해제" : "즐겨찾기"}
          >
            <Star
              size={16}
              aria-hidden="true"
              fill={favorite ? "currentColor" : "none"}
            />
          </button>
          <span className={styles.refreshWrap}>
            <button
              type="button"
              className={styles.refresh}
              // Spends official API calls: never pressed again after hydration.
              data-no-replay
              onClick={onRefresh}
              disabled={disabled}
              aria-describedby={tooltipId}
            >
              {fetching ? (
                <InlineOrb />
              ) : (
                <RefreshCw size={14} aria-hidden="true" />
              )}
              {fetching
                ? "갱신 중"
                : rateLimitSeconds > 0
                  ? `${remainingLabel(rateLimitSeconds * 1000)} 뒤 갱신`
                  : cooling
                    ? remainingLabel(window_.remainingMs)
                    : "갱신"}
            </button>
            <span role="tooltip" id={tooltipId} className={styles.tooltip}>
              {relativeAgo(window_.ageMs)} 갱신 · {kstTime(window_.fetchedAt)}
              <br />
              {cooling
                ? `${remainingLabel(window_.remainingMs)} 후 다시 갱신할 수 있어요${window_.estimated ? " (예상)" : ""}`
                : "지금 다시 갱신할 수 있어요"}
            </span>
          </span>
        </div>
      </div>
      <span className={styles.srOnly} role="status">
        {shareStatus}
      </span>
      {shareStatus && <p className={styles.toast}>{shareStatus}</p>}
    </div>
  );
}

/* Panels -------------------------------------------------------------------- */

function Quality({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  return (
    <span
      className={styles.quality}
      data-tier={qualityTier(value)}
      aria-label={`품질 ${value}`}
    >
      {value}
    </span>
  );
}

function GradeLine({
  grade,
  children,
}: {
  grade: unknown;
  children: ReactNode;
}) {
  return (
    <li
      className={styles.gradeLine}
      data-grade={isGrade(grade) ? grade : undefined}
    >
      <span>{isGrade(grade) ? GRADE_LABEL[grade] : "·"}</span>
      {children}
    </li>
  );
}

function refineOf(item: Equipment) {
  return (
    item.detail?.refineLevel ??
    (/^\+(\d+)/.exec(item.name ?? "")?.[1]
      ? Number(/^\+(\d+)/.exec(item.name ?? "")![1])
      : null)
  );
}

function EquipmentPanel({ data }: { data: Character }) {
  const stagger = useStagger();
  const groups = groupEquipment(data.loadout.equipment);
  const qualityGroups = data.analysis.equipment?.qualityGroups;
  const armorQ = averageQuality(qualityGroups, "WEAPON_ARMOR");
  const accQ = averageQuality(qualityGroups, "ACCESSORY");
  if (!data.loadout.equipment.length)
    return (
      <Panel title="장비">
        <Empty state={data.coverage.equipment} />
      </Panel>
    );
  return (
    <Panel title="장비">
      <div className={styles.equipGrid}>
        <div>
          {armorQ != null && (
            <p className={styles.columnHead}>
              품질 <b>{armorQ}</b>
            </p>
          )}
          <ul className={styles.itemList}>
            {groups.armor.map((item, i) => {
              const refine = refineOf(item);
              return (
                <ItemTooltip key={i} item={item} slot={SLOT_LABEL[item.type ?? ""] ?? undefined} {...stagger(i, styles.item)}>
                  <GameIcon src={item.icon} grade={item.grade} />
                  <div className={styles.itemText}>
                    <strong>
                      {SLOT_LABEL[item.type ?? ""] ?? text(item.type)}
                      {refine != null && <em> +{refine}</em>}
                      {item.detail?.tier != null && (
                        <span className={styles.tierText}>
                          {" "}
                          T{item.detail.tier}
                        </span>
                      )}
                    </strong>
                    <span className={styles.badges}>
                      <Quality value={item.detail?.quality} />
                      {item.detail?.itemLevel != null && (
                        <span
                          className={styles.levelBadge}
                          aria-label={`아이템 레벨 ${item.detail.itemLevel}`}
                        >
                          {item.detail.itemLevel}
                        </span>
                      )}
                    </span>
                  </div>
                </ItemTooltip>
              );
            })}
          </ul>
        </div>
        <div>
          {accQ != null && (
            <p className={styles.columnHead}>
              품질 <b>{accQ}</b>
            </p>
          )}
          <ul className={styles.itemList}>
            {groups.accessories.map((item, i) => (
              <ItemTooltip key={i} item={item} {...stagger(i, styles.item)}>
                <GameIcon src={item.icon} grade={item.grade} />
                <div className={styles.itemText}>
                  <strong>
                    {text(item.type)}
                    {item.detail?.tier != null && (
                      <span className={styles.tierText}>
                        {" "}
                        T{item.detail.tier}
                      </span>
                    )}
                  </strong>
                  <span className={styles.badges}>
                    <Quality value={item.detail?.quality} />
                    {item.detail?.arkPassivePoint && (
                      <span
                        className={styles.levelBadge}
                        aria-label={`${item.detail.arkPassivePoint.name} ${item.detail.arkPassivePoint.value}`}
                      >
                        +{item.detail.arkPassivePoint.value}
                      </span>
                    )}
                  </span>
                </div>
                {item.detail?.polishEffects.length ? (
                  <ul className={styles.gradeList}>
                    {item.detail.polishEffects.map((effect, j) => (
                      <GradeLine key={j} grade={effect.grade}>
                        {effect.name} {effect.value}
                      </GradeLine>
                    ))}
                  </ul>
                ) : null}
              </ItemTooltip>
            ))}
          </ul>
        </div>
      </div>
      <div className={styles.equipFoot}>
        {groups.stone && (
          <ItemTooltip item={groups.stone} slot="어빌리티 스톤" as="div" className={styles.footItem}>
            <GameIcon
              src={groups.stone.icon}
              grade={groups.stone.grade}
              size={40}
            />
            <div>
              <strong>어빌리티 스톤</strong>
              {groups.stone.detail?.stoneEngravings.length ? (
                <ul className={styles.inlineList}>
                  {groups.stone.detail.stoneEngravings.map((engraving, i) => (
                    <li key={i}>
                      {engraving.name} <b>Lv.{engraving.level}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <small>{text(groups.stone.name)}</small>
              )}
            </div>
          </ItemTooltip>
        )}
        {groups.bracelet && (
          <ItemTooltip item={groups.bracelet} slot="팔찌" as="div" className={styles.footItem} wide>
            <GameIcon
              src={groups.bracelet.icon}
              grade={groups.bracelet.grade}
              size={40}
            />
            <div>
              <strong>팔찌</strong>
              {groups.bracelet.detail?.braceletEffects.length ? (
                <ul className={styles.gradeList} data-flow="">
                  {groups.bracelet.detail.braceletEffects.map((effect, i) => (
                    <GradeLine key={i} grade={effect.grade}>
                      <span className={styles.preLine}>{effect.text}</span>
                    </GradeLine>
                  ))}
                </ul>
              ) : (
                <small>{text(groups.bracelet.name)}</small>
              )}
            </div>
          </ItemTooltip>
        )}
        {groups.others.map((item, i) => (
          <div key={i} className={styles.footItem}>
            <GameIcon src={item.icon} grade={item.grade} size={40} />
            <div>
              <strong>{text(item.type)}</strong>
              <small>{text(item.name)}</small>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function GemsPanel({ data }: { data: Character }) {
  const stagger = useStagger();
  const gems = data.loadout.gems?.items ?? [];
  const summary = data.analysis.gems;
  const baseAttack = gemBaseAttack(data.loadout.gems?.effects?.description);
  return (
    <Panel
      title="보석"
      meta={
        summary && gems.length
          ? [
              `평균 ${number(summary.averageLevel)}`,
              `뎀 ${summary.damageEffectCount}`,
              `쿨 ${summary.cooldownEffectCount}`,
              baseAttack != null && `기본 공격력 +${baseAttack}%`,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
    >
      {gems.length ? (
        <ul className={styles.gemGrid}>
          {gems.map((gem, i) => (
            <li key={i} {...stagger(i)}>
              <GameIcon src={gem.icon} grade={gem.grade} size={44} />
              <span data-kind={gemKind(gem.name) ?? undefined}>
                {gem.level != null && gem.level > 0 ? gem.level : "?"}
                {gemKind(gem.name) ?? ""}
              </span>
              <small>{text(gem.name)}</small>
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          state={
            data.coverage.gems.collections.items ?? data.coverage.gems.state
          }
        />
      )}
    </Panel>
  );
}

function ArkGridPanel({ data }: { data: Character }) {
  const grid = data.loadout.arkGrid;
  const summary = data.analysis.arkGrid;
  const [expanded, setExpanded] = useState(false);
  if (!grid)
    return (
      <Panel title="아크 그리드">
        <Empty state={data.coverage.arkGrid.state} />
      </Panel>
    );
  const hasDetail = grid.slots.some(
    (slot) => slot.options.length > 0 || slot.gems.some((gem) => gem.name),
  );
  return (
    <Panel
      title="아크 그리드"
      meta={
        <span className={styles.gridMeta}>
          {summary?.orderPoints != null && <span>질서 <b>{summary.orderPoints}</b>P</span>}
          {summary?.chaosPoints != null && <span>혼돈 <b>{summary.chaosPoints}</b>P</span>}
          {grid.willpower && (
            <span>
              의지력 <b>{grid.willpower.used}</b>/{grid.willpower.supply}
            </span>
          )}
          {hasDetail && (
            <button
              type="button"
              className={styles.textButton}
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "모두 접기" : "모두 펼치기"}
            </button>
          )}
        </span>
      }
    >
      {grid.effects.length > 0 && (
        <ul className={styles.effectGrid}>
          {grid.effects.map((effect, i) => (
            <li key={i}>
              <span>{text(effect.name)}</span>
              <span>
                <small>Lv.{number(effect.level)}</small>
                {effect.percent != null && (
                  <b>+{effect.percent.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%</b>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {grid.slots.length ? (
        <ul className={styles.coreList}>
          {grid.slots.map((slot, i) => (
            <li key={i}>
              <details open={expanded || undefined} className={`${styles.core} ${expand.expand}`}>
                <summary>
                  <GameIcon src={slot.icon} grade={slot.grade} size={40} />
                  <div className={styles.itemText}>
                    <small>
                      {slot.coreType ?? text(slot.name).split(" : ")[0]}
                    </small>
                    <strong data-grade={slot.grade ?? undefined}>
                      {text(slot.name).replace(/^.*?:\s*/, "")}
                    </strong>
                  </div>
                  <span className={styles.coreFacts}>
                    <b>{number(slot.point)}P</b>
                    {slot.optionCount > 0 && (
                      <small>
                        옵션 {slot.activeOptionCount}/{slot.optionCount}
                      </small>
                    )}
                  </span>
                  <span className={styles.coreGems}>
                    {slot.gems.map((gem, j) => (
                      <GameIcon
                        key={j}
                        src={gem.icon}
                        grade={gem.grade}
                        size={24}
                        inactive={gem.active === false}
                      />
                    ))}
                  </span>
                </summary>
                {(slot.options.length > 0 || slot.gems.some((gem) => gem.name)) && (
                  <div className={styles.coreDetail}>
                    {slot.options.length > 0 && (
                      <ul className={styles.coreOptions}>
                        {slot.options.map((option) => (
                          <li key={option.threshold} data-active={option.active || undefined}>
                            <b>{option.threshold}P</b>
                            <SourceText value={option.text} />
                          </li>
                        ))}
                      </ul>
                    )}
                    {slot.gems.some((gem) => gem.name) && (
                      <ul className={styles.gemRows}>
                        {slot.gems.map((gem, j) => (
                          <li key={j} data-inactive={gem.active === false || undefined}>
                            <GameIcon src={gem.icon} grade={gem.grade} size={28} />
                            <span>
                              <strong>{text(gem.name)}</strong>
                              <small>
                                {[
                                  gem.corePoint != null && `포인트 ${gem.corePoint}`,
                                  gem.requiredWillpower != null && `의지력 ${gem.requiredWillpower}`,
                                  ...gem.options.map(
                                    (o) => `${o.name}${o.level != null ? ` Lv.${o.level}` : ""}`,
                                  ),
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </small>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {slot.supplyWillpower != null && (
                      <p className={styles.coreNote}>
                        의지력 {number(slot.usedWillpower)}/{slot.supplyWillpower}
                        {slot.conditions.length > 0 && ` · ${slot.conditions.join(" · ")}`}
                      </p>
                    )}
                  </div>
                )}
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <Empty state={data.coverage.arkGrid.collections.slots} />
      )}
    </Panel>
  );
}

function CardsPanel({ data }: { data: Character }) {
  const stagger = useStagger();
  const cards = data.loadout.cards;
  const summary = data.analysis.cards;
  return (
    <Panel
      title="카드"
      meta={summary ? `각성 합 ${summary.knownAwakeningTotal}` : undefined}
    >
      {cards?.items.length ? (
        <>
          <ul className={styles.cardGrid}>
            {cards.items.map((card, i) => (
              <li key={i} {...stagger(i)}>
                <CardArt
                  src={card.icon}
                  name={text(card.name)}
                  grade={card.grade}
                  awakeCount={card.awakeCount}
                  awakeTotal={card.awakeTotal}
                />
              </li>
            ))}
          </ul>
          {cards.effects.length > 0 && (
            <ul className={styles.setList}>
              {cards.effects
                .flatMap((set) => set.items)
                .map((effect, i) => (
                  <li key={i}>
                    <strong>{text(effect.name)}</strong>
                    <span>
                      <SourceText value={effect.description} />
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </>
      ) : (
        <Empty
          state={
            data.coverage.cards.collections.items ?? data.coverage.cards.state
          }
        />
      )}
      <CardCollection name={data.characterName} />
    </Panel>
  );
}

function passiveByTree(data: Character) {
  const effects = data.loadout.arkPassive?.effects ?? [];
  return ARK_TREES.map((tree) => ({
    tree,
    point: data.loadout.arkPassive?.points.find((point) => point.name === tree),
    nodes: effects
      .map((effect) => ({
        effect,
        parsed: parsePassiveNode(effect.description),
      }))
      .filter(({ parsed }) => parsed.tree === tree),
  }));
}

function ArkPassiveSummary({
  data,
  detailed = false,
}: {
  data: Character;
  detailed?: boolean;
}) {
  if (!data.loadout.arkPassive)
    return (
      <Panel title="아크 패시브">
        <Empty state={data.coverage.arkPassive.state} />
      </Panel>
    );
  const trees = passiveByTree(data);
  return (
    <Panel
      title="아크 패시브"
      meta={
        detailed ? undefined : (
          <Link href="?tab=arkpassive" replace scroll={false}>
            자세히
          </Link>
        )
      }
    >
      <dl className={styles.points}>
        {trees.map(({ tree, point }) => (
          <div key={tree} data-tree={tree}>
            <dt>{tree}</dt>
            <dd>{point?.value ?? "—"}</dd>
            {detailed && point?.description && (
              <small>{point.description}</small>
            )}
          </div>
        ))}
      </dl>
      {trees.map(({ tree, nodes }) =>
        nodes.length ? (
          <div key={tree} className={styles.tree}>
            <h3>{tree}</h3>
            <ul>
              {nodes.map(({ effect, parsed }, i) => (
                <li key={i}>
                  <GameIcon src={effect.icon} size={28} />
                  <span className={styles.nodeName}>{parsed.node}</span>
                  <small>T{parsed.tier}</small>
                  <b>Lv.{parsed.level}</b>
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </Panel>
  );
}

function StatsPanel({ data }: { data: Character }) {
  const combat = COMBAT_STATS.map(
    (type) => [type, statNumber(data.stats, type)] as const,
  ).filter(([, value]) => value != null && value > 0);
  const total = COMBAT_STATS.reduce(
    (sum, type) => sum + (statNumber(data.stats, type) ?? 0),
    0,
  );
  const attack = data.stats.find((stat) => stat.type === "공격력");
  const health = data.stats.find((stat) => stat.type === "최대 생명력");
  if (!data.stats.length)
    return (
      <Panel title="특성">
        <p className={styles.muted}>능력치가 제공되지 않았어요.</p>
      </Panel>
    );
  return (
    <Panel title="특성">
      <dl className={styles.statGrid}>
        {combat
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
          .slice(0, 2)
          .map(([type, value]) => (
            <div key={type}>
              <dt>{type}</dt>
              <dd>{number(value)}</dd>
            </div>
          ))}
        <div>
          <dt>특성합</dt>
          <dd>{number(total)}</dd>
        </div>
        {attack && (
          <div>
            <dt>공격력</dt>
            <dd>{numeric(attack.value)}</dd>
          </div>
        )}
        {health && (
          <div>
            <dt>최대 생명력</dt>
            <dd>{numeric(health.value)}</dd>
          </div>
        )}
      </dl>
      {data.stats.some((stat) => stat.tooltip.length) && (
        <details className={`${styles.statDetail} ${expand.expand}`}>
          <summary>특성 원문</summary>
          <dl>
            {data.stats
              .filter((stat) => stat.tooltip.length)
              .map((stat) => (
                <div key={stat.type}>
                  <dt>
                    {stat.type} <b>{numeric(stat.value)}</b>
                  </dt>
                  {stat.tooltip.map((line, i) => (
                    <dd key={i}>{line}</dd>
                  ))}
                </div>
              ))}
          </dl>
        </details>
      )}
    </Panel>
  );
}

function EngravingsPanel({ data }: { data: Character }) {
  const stagger = useStagger();
  const effects = data.loadout.engravings?.arkPassiveEffects ?? [];
  const book = engravingBookString(effects);
  const bonus = stoneBonus(groupEquipment(data.loadout.equipment).stone);
  return (
    <Panel
      title="각인"
      meta={book ? `${effects[0]?.grade ?? ""} ${book}`.trim() : undefined}
    >
      {effects.length ? (
        <ul className={styles.engravings}>
          {effects.map((effect, i) => (
            <li key={i} {...stagger(i)}>
              <strong>{text(effect.name)}</strong>
              <span>
                {text(effect.grade)} ×{number(effect.level)}
                {effect.abilityStoneLevel != null &&
                  effect.abilityStoneLevel > 0 &&
                  ` · 스톤 Lv.${effect.abilityStoneLevel}`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          state={
            data.coverage.engravings.collections.arkPassiveEffects ??
            data.coverage.engravings.state
          }
        />
      )}
      {bonus && (
        <p className={styles.stoneBonus}>
          세공 레벨 보너스 활성화 <b>({bonus})</b>
        </p>
      )}
    </Panel>
  );
}

function SkillCard({ skill, compact }: { skill: Skill; compact?: boolean }) {
  return (
    <li className={styles.skill}>
      <div className={styles.skillHead}>
        <GameIcon src={skill.icon} size={36} />
        <div className={styles.itemText}>
          <strong>{text(skill.name)}</strong>
          <small>
            {level(skill.level)}
            {skill.rune && ` · ${text(skill.rune.name)}`}
            {skill.partBreakLevel != null &&
              ` · 부위 파괴 Lv.${skill.partBreakLevel}`}
            {skill.counter && " · 카운터"}
          </small>
        </div>
        {skill.rune && (
          <GameIcon src={skill.rune.icon} grade={skill.rune.grade} size={24} />
        )}
      </div>
      {skill.tripods.length > 0 && (
        <ul className={styles.tripods}>
          {skill.tripods.map((tripod, i) => (
            <li key={i}>
              <GameIcon src={tripod.icon} size={20} />
              {compact ? null : <span>{text(tripod.name)}</span>}
            </li>
          ))}
        </ul>
      )}
      {!compact && skill.gemEffects.length > 0 && (
        <ul className={styles.gemEffects}>
          {skill.gemEffects.map((effect, i) => (
            <li key={i} data-kind={effect.kind ?? undefined}>
              {effect.text}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function SkillOverview({
  data,
  full = false,
}: {
  data: Character;
  full?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  const skills = data.loadout.skills;
  if (skills === undefined)
    return (
      <Panel title="스킬" wide>
        <p className={styles.muted}>
          스킬 정보는 최신 조회 서버에서 제공돼요. 다시 갱신하면 표시될 수
          있어요.
        </p>
      </Panel>
    );
  const summary = skillSummary(skills);
  const list = full && showAll ? skills : summary.active;
  return (
    <Panel
      title="스킬"
      wide
      meta={
        <>
          {data.skillPoints &&
            `SP ${data.skillPoints.used}/${data.skillPoints.total}`}
          {summary.partBreakLevel != null &&
            ` · 부위 파괴 Lv.${summary.partBreakLevel} ×${summary.partBreakCount}`}
          {` · 카운터 ${summary.counterCount}개`}
          {!full && (
            <>
              {" · "}
              <Link href="?tab=skills" replace scroll={false}>
                자세히
              </Link>
            </>
          )}
        </>
      }
    >
      {list.length ? (
        <ul id={listId} className={styles.skillGrid} data-compact={!full || undefined}>
          {list.map((skill, i) => (
            <SkillCard
              key={`${skill.name}-${i}`}
              skill={skill}
              compact={!full}
            />
          ))}
        </ul>
      ) : (
        <Empty state={data.coverage.skills} />
      )}
      {full && skills.length > summary.active.length && (
        <button
          type="button"
          className={styles.textButton}
          aria-expanded={showAll}
          aria-controls={listId}
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll
            ? "사용 중인 스킬만 보기"
            : `전체 ${skills.length}개 스킬 보기`}
        </button>
      )}
    </Panel>
  );
}

/* Tabs ---------------------------------------------------------------------- */

export function CombatTab({ data }: { data: Character }) {
  return (
    <div className={styles.layout}>
      <div className={styles.columns}>
        <div className={styles.stack}>
          <EquipmentPanel data={data} />
          <GemsPanel data={data} />
          <ArkGridPanel data={data} />
          <CardsPanel data={data} />
        </div>
        <aside className={styles.stack} aria-label="요약">
          <RankPanel name={data.characterName} />
          <ArkPassiveSummary data={data} />
          <StatsPanel data={data} />
          <EngravingsPanel data={data} />
          <ViewsPanel name={data.characterName} />
        </aside>
      </div>
      <SkillOverview data={data} />
    </div>
  );
}

export function SkillsTab({ data }: { data: Character }) {
  return (
    <div className={styles.layout}>
      <SkillOverview data={data} full />
    </div>
  );
}

export function ArkPassiveTab({ data }: { data: Character }) {
  const trees = passiveByTree(data);
  return (
    <div className={styles.layout}>
      <div className={styles.columns}>
        <div className={styles.stack}>
          {trees.map(({ tree, nodes }) => (
            <Panel key={tree} title={tree} meta={`${nodes.length}개 노드`}>
              {nodes.length ? (
                <ul className={styles.passiveDetail}>
                  {nodes.map(({ effect, parsed }, i) => (
                    <li key={i}>
                      <GameIcon src={effect.icon} size={36} />
                      <div className={styles.itemText}>
                        <strong>
                          {parsed.node}{" "}
                          <small>
                            T{parsed.tier} · Lv.{parsed.level}
                          </small>
                        </strong>
                        <p>
                          <SourceText
                            value={effect.effect ?? effect.description}
                          />
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>
                  이 트리에서 확인된 노드가 없어요.
                </p>
              )}
            </Panel>
          ))}
        </div>
        <aside className={styles.stack}>
          <ArkPassiveSummary data={data} detailed />
          <EngravingsPanel data={data} />
        </aside>
      </div>
    </div>
  );
}

type Sibling = NonNullable<Character["siblings"]>[number];

function SiblingList({
  siblings,
  current,
}: {
  siblings: Sibling[];
  current: string;
}) {
  const sorted = [...siblings].sort(
    (a, b) => (b.itemLevel ?? 0) - (a.itemLevel ?? 0),
  );
  const servers = [...new Set(sorted.map((sibling) => sibling.serverName))];
  return (
    <>
      {servers.map((server) => (
        <Panel
          key={server}
          title={server}
          meta={`${sorted.filter((s) => s.serverName === server).length}명`}
          wide
        >
          <ul className={styles.siblingGrid}>
            {sorted
              .filter((sibling) => sibling.serverName === server)
              .map((sibling, i) => {
                const isCurrent = sibling.characterName === current;
                const linkable =
                  !isCurrent && !characterNameError(sibling.characterName);
                const body = (
                  <>
                    <strong>{sibling.characterName}</strong>
                    <small>
                      {sibling.className} · Lv.{number(sibling.characterLevel)}
                    </small>
                    <b>{number(sibling.itemLevel)}</b>
                  </>
                );
                return (
                  <li
                    key={`${sibling.characterName}-${i}`}
                    data-current={isCurrent || undefined}
                  >
                    {linkable ? (
                      <Link
                        prefetch={false}
                        href={`/character/${encodeURIComponent(normalizeCharacterName(sibling.characterName))}`}
                      >
                        {body}
                        <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    ) : (
                      <div>{body}</div>
                    )}
                  </li>
                );
              })}
          </ul>
        </Panel>
      ))}
    </>
  );
}

function QueryProblem({
  error,
  onRetry,
  subject,
}: {
  error: unknown;
  onRetry: () => void;
  subject: string;
}) {
  const info =
    error instanceof CharacterQueryError
      ? error.info
      : { code: "LOST_ARK_API_ERROR", status: 502 };
  const limit = useRateLimit(error);
  const copy =
    info.code === "CHARACTER_HISTORY_DISABLED"
      ? {
          title: "기록 기능이 꺼져 있어요",
          text: "서비스에서 기록 저장을 사용하지 않고 있어요.",
        }
      : info.code === "CHARACTER_HISTORY_UNAVAILABLE"
        ? {
            title: "기록을 잠시 불러올 수 없어요",
            text: "저장소에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
          }
        : info.code === "LOST_ARK_RATE_LIMITED"
          ? rateLimitCopy()
          : info.code === "LOST_ARK_NOT_CONFIGURED" ||
            info.code === "FRONTEND_API_NOT_CONFIGURED"
          ? failureCopy(info)
          : {
              title: `${subject} 불러오지 못했어요`,
              text: "캐릭터 정보는 그대로예요. 잠시 후 다시 시도해 주세요.",
            };

  return (
    <div className={styles.problem}>
      <div role="alert">
        <strong>{copy.title}</strong>
        <p>{copy.text}</p>
      </div>
      {limit.limited && <RateLimitNote seconds={limit.seconds} />}
      <button
        type="button"
        className={styles.textButton}
        onClick={onRetry}
        disabled={limit.seconds > 0}
      >
        {retryLabel(limit.seconds)}
      </button>
    </div>
  );
}

/**
 * Roster titles (backend #123): what LOAKraken has seen equipped across the
 * same-server roster, in first-seen order. Never called acquisition order or
 * date; only equipped titles are recorded (PM wording).
 */
function RosterTitlesPanel({ name }: { name: string }) {
  const noteId = useId();
  const query = useQuery({
    queryKey: ["roster-titles", name],
    queryFn: ({ signal }) => fetchTitles(name, signal),
    staleTime: 5 * 60_000,
  });
  const fade = useCrossfade(query.isPending);
  const result = query.data?.data;
  const titles = result ? byObservedOrder(result.titles) : [];
  const groups = groupByDay(titles);
  return (
    <Panel
      title="원정대 칭호"
      wide
      meta={result ? `${titles.length}개 · 원정대 ${result.rosterCharacters}명 중 ${result.observedCharacters}명 기록` : undefined}
    >
      <p className={styles.titleNote} id={noteId}>
        <span>
          LOAKraken에서 처음 확인한 순서<span className={styles.srOnly}>.</span>
        </span>
        <span className={styles.titleInfo}>
          <Info size={13} aria-hidden="true" />
          장착한 칭호만 기록되며 실제 획득일과 다를 수 있어요
        </span>
      </p>
      {query.isPending ? (
        <p className={styles.muted} role="status">
          <InlineOrb /> 칭호 기록을 불러오고 있어요.
        </p>
      ) : query.isError ? (
        <QueryProblem error={query.error} onRetry={() => query.refetch()} subject="칭호 기록을" />
      ) : titles.length === 0 ? (
        <p className={styles.muted}>
          아직 확인한 칭호가 없어요. 원정대 캐릭터를 조회하면 그때 장착한 칭호가 기록돼요.
        </p>
      ) : (
        <ol ref={fade} className={styles.titleList} aria-describedby={noteId}>
          {groups.map((group, i) =>
            group.titles.length === 1 ? (
              <li key={group.day + group.titles[0].title}>
                <b>{i + 1}</b>
                <strong>{group.titles[0].title}</strong>
                <small>
                  처음 확인 {group.day} · {group.titles[0].recordedBy}
                </small>
              </li>
            ) : (
              // Same day: these came in together, so no order inside (backend #176).
              <li key={group.day} className={styles.titleDay}>
                <b>{i + 1}</b>
                <span className={styles.titleDayHead}>
                  같은 날 확인 {group.titles.length}개 · {group.day}
                </span>
                <ul>
                  {group.titles.map((title) => (
                    <li key={title.title}>
                      <strong>{title.title}</strong>
                      <small>{title.recordedBy}</small>
                    </li>
                  ))}
                </ul>
              </li>
            ),
          )}
        </ol>
      )}
    </Panel>
  );
}

export function SiblingsTab({ data }: { data: Character }) {
  const embedded = data.siblings;
  const query = useQuery({
    queryKey: ["siblings", data.characterName],
    queryFn: ({ signal }) => fetchSiblings(data.characterName, signal),
    enabled: embedded == null,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  if (embedded != null)
    return (
      <div className={styles.layout}>
        {embedded.length ? (
          <SiblingList siblings={embedded} current={data.characterName} />
        ) : (
          <Panel title="원정대" wide>
            <Empty state={data.coverage.siblings} />
          </Panel>
        )}
        <RosterTitlesPanel name={data.characterName} />
        {/* Last: it arrives after a slow roster calculation and must not push the titles. */}
        <ReceiptPanel name={data.characterName} />
      </div>
    );
  const result = query.data?.data;
  return (
    <div className={styles.layout}>
      {query.isPending ? (
        <Panel title="원정대" wide>
          <p className={styles.muted} role="status">
            <InlineOrb /> 원정대를 불러오고 있어요.
          </p>
        </Panel>
      ) : query.isError ? (
        <Panel title="원정대" wide>
          <QueryProblem
            error={query.error}
            onRetry={() => query.refetch()}
            subject="원정대를"
          />
        </Panel>
      ) : result && result.siblings.length ? (
        <>
          <p className={styles.caption}>
            원정대 갱신 {kstTime(result.fetchedAt)}
            {result.refreshAvailableAt &&
              ` · ${kstTime(result.refreshAvailableAt)} 이후 다시 갱신`}
          </p>
          <SiblingList
            siblings={result.siblings}
            current={data.characterName}
          />
        </>
      ) : (
        <Panel title="원정대" wide>
          <p className={styles.muted}>원정대 캐릭터가 없어요.</p>
        </Panel>
      )}
      <RosterTitlesPanel name={data.characterName} />
      <ReceiptPanel name={data.characterName} />
    </div>
  );
}

export function StatsTab({ data }: { data: Character }) {
  const query = useQuery({
    queryKey: ["history", data.characterName, data.serverName],
    queryFn: ({ signal }) =>
      fetchHistory(data.characterName, data.serverName, signal),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const fade = useCrossfade(query.isPending);
  const points = query.data?.data.points ?? [];
  const [table, setTable] = useState(false);
  const first = points[0];
  return (
    <div className={styles.layout}>
      <p className={styles.caption}>
        LOAKraken에서 이 캐릭터를 조회한 시점부터 기록돼요. 값이 바뀐
        시점만 점으로 남고, 마지막 값은 최근 확인 시각까지 이어서 그려요.
      </p>
      {query.isPending ? (
        <Panel title="통계" wide>
          <p className={styles.muted} role="status">
            <InlineOrb /> 기록을 불러오고 있어요.
          </p>
        </Panel>
      ) : query.isError ? (
        <Panel title="통계" wide>
          <QueryProblem
            error={query.error}
            onRetry={() => query.refetch()}
            subject="기록을"
          />
        </Panel>
      ) : !points.length ? (
        <Panel title="통계" wide>
          <p className={styles.muted}>
            아직 기록이 없어요. 조회가 쌓이면 변화 그래프가 표시돼요.
          </p>
        </Panel>
      ) : (
        <>
          <div ref={fade} className={styles.chartGrid}>
            {METRICS.map(({ key, label }) => {
              const steps = stepSeries(points, key);
              const delta = change(steps);
              return (
                <Panel
                  key={key}
                  title={label}
                  meta={
                    delta == null
                      ? "기록 1개"
                      : `기록 이후 ${delta >= 0 ? "+" : ""}${number(delta)}`
                  }
                >
                  {steps.length ? (
                    <HistoryChart label={label} steps={steps} />
                  ) : (
                    <p className={styles.muted}>이 값은 기록되지 않았어요.</p>
                  )}
                </Panel>
              );
            })}
          </div>
          <Panel
            title="기록 표"
            wide
            meta={
              <button
                type="button"
                className={styles.textButton}
                onClick={() => setTable((v) => !v)}
                aria-expanded={table}
              >
                {table ? "접기" : `${points.length}개 기록 보기`}
              </button>
            }
          >
            {first && (
              <p className={styles.muted}>
                첫 기록 {kstTime(first.observedAt)} · 최근 확인{" "}
                {kstTime(points.at(-1)!.lastConfirmedAt)}
              </p>
            )}
            {table && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">기록 시점</th>
                      <th scope="col">아이템 레벨</th>
                      <th scope="col">전투력</th>
                      <th scope="col">원정대</th>
                      <th scope="col">최근 확인</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...points].reverse().map((point) => (
                      <tr key={point.observedAt}>
                        <td>{kstTime(point.observedAt)}</td>
                        <td>{number(point.itemLevel)}</td>
                        <td>{number(point.combatPower)}</td>
                        <td>{number(point.expeditionLevel)}</td>
                        <td>{kstTime(point.lastConfirmedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

const collectionLabels: Record<string, string> = {
  items: "항목",
  effects: "효과",
  slots: "슬롯",
  arkPassiveEffects: "패시브 각인",
  points: "포인트",
};

export function EvidenceTab({
  data,
  envelope,
}: {
  data: Character;
  envelope: CharacterEnvelope;
}) {
  const findings = data.analysis.diagnostics.findings;
  const sections = Object.entries(data.coverage).map(([key, value]) => ({
    key,
    value,
  }));
  return (
    <div className={styles.layout}>
      <Panel
        title="세팅 점검 결과"
        meta={data.analysis.diagnostics.ruleVersion}
        wide
      >
        <p className={styles.muted}>
          정보 부족은 세팅 오류를 뜻하지 않아요. 확인 항목도 의도한 세팅일 수
          있어요.
        </p>
        {findings.length === 0 ? (
          <p className={styles.muted}>
            현재 규칙에서 발견된 확인 항목이 없어요. 모든 세팅이 완성됐다는 뜻은
            아니에요.
          </p>
        ) : (
          <ul className={styles.findings}>
            {findings.map((finding, i) => (
              <li key={`${finding.code}-${i}`} data-category={finding.category}>
                <span className={styles.findingCategory}>
                  {finding.category === "DATA_GAP"
                    ? "정보 부족"
                    : finding.category === "SETTING_CHECK"
                      ? "세팅 확인"
                      : "참고"}
                </span>
                <p>{finding.message}</p>
                {finding.observedCount !== null && (
                  <small>확인 {number(finding.observedCount)}개</small>
                )}
                <Evidence envelope={envelope} path={finding.evidencePath} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="원천 제공 상태" wide>
        <ul className={styles.coverageList}>
          {sections.map(({ key, value }) => {
            const state =
              typeof value === "string" || value === null ? value : value.state;
            return (
              <li key={key}>
                <strong>{key}</strong>
                <span data-state={state ?? undefined}>
                  {state ? coverageLabel(state) : "조회 안 함"}
                </span>
                {value && typeof value === "object" && (
                  <small>
                    {Object.entries(value.collections)
                      .map(
                        ([name, item]) =>
                          `${collectionLabels[name] ?? name} ${item ? coverageLabel(item) : "-"}`,
                      )
                      .join(" · ")}
                  </small>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

function TabPanelView({
  tab,
  data,
  envelope,
}: {
  tab: TabId;
  data: Character;
  envelope: CharacterEnvelope;
}) {
  return (
    <Reveal key={tab} className={styles.tabPanel}>
      {tab === "skills" ? (
        <SkillsTab data={data} />
      ) : tab === "arkpassive" ? (
        <ArkPassiveTab data={data} />
      ) : tab === "collectibles" ? (
        <CollectiblesTab data={data} />
      ) : tab === "avatars" ? (
        <AvatarsTab data={data} />
      ) : tab === "stats" ? (
        <StatsTab data={data} />
      ) : tab === "siblings" ? (
        <SiblingsTab data={data} />
      ) : tab === "evidence" ? (
        <EvidenceTab data={data} envelope={envelope} />
      ) : (
        <CombatTab data={data} />
      )}
    </Reveal>
  );
}

/**
 * The tab's content, re-rendered only when the tab or the character data
 * changes. The page above it ticks every second (refresh countdown) and
 * updates once after hydration (motion context); without this every tick
 * re-rendered every panel — hundreds of ms on a slow phone.
 */
export const TabPanel = memo(TabPanelView);
