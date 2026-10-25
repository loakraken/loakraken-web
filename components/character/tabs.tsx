"use client";

import {
  createContext,
  memo,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, Bookmark, BookmarkBold, ChevronDown, InfoCircle, RefreshArrow, Share } from "@/components/ui/icons";
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
  isCooldownGem,
  engravingBookString,
  groupEquipment,
  isGrade,
  parsePassiveNode,
  qualityTier,
  refreshWindow,
  relativeAgo,
  remainingLabel,
  gemCounts,
  skillGems,
  otherSkillGems,
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
  fetchRosterPower,
  fetchSiblings,
  fetchTitles,
} from "@/lib/character/client";
import {
  METRICS,
  historySummary,
  shortDate,
  stepSeries,
} from "@/lib/character/history";
import { MINUTE, useClock } from "@/components/home/clock";
import { failureCopy } from "@/lib/character/model";
import { arkGridRealView, braceletRealView, type ArkGridRealView } from "@/lib/character/efficiency-real";
import { HistoryChart } from "./history-chart";
import { AvatarsTab, CollectiblesTab } from "./inner";
import { Panel } from "./panel";
import { ViewsPanel } from "./views-panel";
import { WeeklyGoldPanel } from "./weekly-gold-panel";
import { useTabPill } from "./tab-pill";
import {
  CoreCard,
  DetailTooltip,
  EngravingCard,
  GemCard,
  GridGemCard,
  ItemTooltip,
  PassiveNodeCard,
  RuneCard,
  SkillDetailCard,
} from "./item-tooltip";
import { sourcePlainText } from "@/lib/character/source-text";
import { useItemTooltips } from "./use-item-tooltips";
import { useArmoryPage } from "./use-armory-page";
import { tripodLevel, type ArmoryPage } from "@/lib/character/armory-page";
import {
  equipmentExtra,
  gemLines,
  gridGemLines,
  gridLines,
  runeLines,
  skillLines,
  staggerOf,
  type SkillLines,
} from "@/lib/character/item-tooltips";
import { ReceiptEnabled, ReceiptPanel } from "./receipt-panel";
import { PillTab, PillTabs, PillTabsPanel } from "@/components/ui/pill-tabs";
import { SegmentedControl, SegmentedItem } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  classMix,
  levelBands,
  maskName,
  ROSTER_SORTS,
  powerByName,
  ROSTER_TOTAL_MIN,
  rosterStats,
  rosterSummary,
  sixBasis,
  sortSiblings,
  type PowerRecord,
  type RosterSort,
} from "@/lib/character/roster-list";
import { useStagger } from "./entrance";
import { fetchTitleEquip } from "@/lib/stats/client";
import { equipShare, titleEquipQuery, type EquippedTitle } from "@/lib/stats/title-equip";
import { RosterPower, rosterPowerKey, useRosterPowerRefreshing } from "./roster-power";
import { StatSheet } from "./stat-sheet";
import { AnalysisMenu } from "./analysis-menu";
import { RankPanel } from "./rank-panel";
import { GuildTab } from "./guild-tab";
import { SimulatorTab } from "./simulator-tab";
import { SpecUpTab } from "./spec-up-tab";
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
import { useTallest } from "@/components/ui/use-tallest";
import expand from "@/components/site/expand.module.css";
import { rateLimitCopy, retryLabel } from "@/lib/api/rate-limit";
import { RateLimitNote } from "@/components/site/rate-limit-note";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { useCrossfade } from "@/lib/motion";

export const TABS = [
  { id: "combat", label: "전투" },
  { id: "simulator", label: "시뮬레이터" },
  { id: "specup", label: "스펙업" },
  { id: "skills", label: "스킬" },
  { id: "arkpassive", label: "아크 패시브" },
  { id: "collectibles", label: "내실" },
  { id: "avatars", label: "아바타" },
  { id: "stats", label: "통계" },
  { id: "siblings", label: "원정대" },
  { id: "guild", label: "길드" },
  { id: "evidence", label: "세팅 점검" },
] as const;
export type TabId = (typeof TABS)[number]["id"];

/** SETTING_CHECK_TAB (server flag): off hides the tab and its ?tab= link. */
export const SettingCheckEnabled = createContext(true);
/** COMBAT_POWER_SIM (server flag): off hides the 시뮬레이터 tab the same way. */
export const SimulatorEnabled = createContext(true);
/** TITLE_STATS (server flag): the equip share beside each roster title. */
export const TitleStatsEnabled = createContext(true);
/** SPEC_UP_GUIDE (server flag): off hides the 스펙업 tab the same way. */
export const SpecUpEnabled = createContext(true);
/** GUILD_TAB (server flag, apart from the guild ranking since api #582): off hides the guild tab. */
export const GuildTabEnabled = createContext(true);
/**
 * CHARACTER_EFFICIENCY (server flag): off leaves out the 아크 그리드 효율 and
 * 팔찌 효율 rows whole (no line, no 줄별 보기, no shares, no empty room).
 */
export const CharacterEfficiencyEnabled = createContext(true);
const visibleTabs = (settingCheck: boolean, simulator = true, specUp = true, guild = true) =>
  TABS.filter(
    (tab) =>
      (tab.id !== "evidence" || settingCheck) &&
      (tab.id !== "simulator" || simulator) &&
      (tab.id !== "specup" || specUp) &&
      (tab.id !== "guild" || guild),
  );

/** The visually hidden heading each tab panel starts with (focus target). */
const TAB_HEADING = "character-tab-heading";

/**
 * Going to another tab (the tab bar or a "자세히" link) starts at the top of
 * the page, with focus on the new tab's heading (user 10-11, PM 총괄 21:46).
 * The page itself stays on screen, so Next keeps the position by default;
 * this does it explicitly. The first render keeps the browser's position,
 * and filters inside a tab keep theirs because they leave ?tab= alone.
 */
export function useTabTop(tab: TabId) {
  const last = useRef(tab);
  useEffect(() => {
    if (last.current === tab) return;
    last.current = tab;
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById(TAB_HEADING)?.focus({ preventScroll: true });
  }, [tab]);
}

/** The tab in ?tab=, or 전투 for an unknown one or a hidden one. */
export const tabOf = (value: string | null, settingCheck = true, simulator = true, specUp = true, guild = true): TabId =>
  visibleTabs(settingCheck, simulator, specUp, guild).some((tab) => tab.id === value) ? (value as TabId) : "combat";

/** "베타" next to a tab still growing its rules (shown wherever the tab is). */
function TabLabel({ id, label }: { id: TabId; label: string }) {
  return id === "evidence" ? (
    <>
      {label} <span className={styles.betaChip}>베타</span>
    </>
  ) : (
    label
  );
}

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
  // The guild tab only for a character in a guild.
  const tabs = visibleTabs(
    useContext(SettingCheckEnabled),
    useContext(SimulatorEnabled),
    useContext(SpecUpEnabled),
    useContext(GuildTabEnabled) && Boolean(data.guildName),
  );
  const window_ = refreshWindow(data, now);
  const cooling = window_.remainingMs > 0;
  const disabled = fetching || cooling || rateLimitSeconds > 0;
  const label = fetching
    ? "갱신 중"
    : rateLimitSeconds > 0
      ? remainingLabel(rateLimitSeconds * 1000)
      : cooling
        ? remainingLabel(window_.remainingMs)
        : "갱신";
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
    <div className={styles.tabBar} data-sticky-chrome>
      <div className={styles.tabInner}>
        <nav
          ref={pillNav}
          // Fades at an end where tabs are hidden (A35).
          className={`${styles.tabs} scroll-fade-x`}
          aria-label="캐릭터 정보 탭"
          onKeyDown={pillKey}
          onPointerDown={pillPointer}
        >
          {tabs.map((item) => (
            <Link
              key={item.id}
              href={item.id === "combat" ? "?" : `?tab=${item.id}`}
              replace
              aria-current={tab === item.id ? "page" : undefined}
            >
              <TabLabel id={item.id} label={item.label} />
            </Link>
          ))}
          {/* The selected style, clipped to the current tab (tab-pill.ts). */}
          <span ref={pillLayer} className={styles.pillLayer} aria-hidden="true">
            {tabs.map((item) => (
              <span key={item.id} data-current={tab === item.id || undefined}>
                <TabLabel id={item.id} label={item.label} />
              </span>
            ))}
          </span>
        </nav>
        <div className={styles.tabActions}>
          <AnalysisMenu
            name={name}
            server={data.serverName}
            className={data.className}
            classEngraving={data.loadout.arkPassive?.title}
            specUp={useContext(SpecUpEnabled)}
            simulator={useContext(SimulatorEnabled)}
            favorite={favorite}
            onShare={share}
            onFavorite={toggleFavorite}
          />
          {/* On a narrow screen these two are in the menu above (A35). */}
          <button
            type="button"
            className={`${styles.iconAction} ${styles.wideOnly}`}
            onClick={share}
            aria-label="공유하기"
          >
            <Share size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${styles.iconAction} ${styles.wideOnly}`}
            onClick={toggleFavorite}
            aria-pressed={favorite}
            aria-label={favorite ? "즐겨찾기 해제" : "즐겨찾기"}
          >
            {favorite ? (
              <BookmarkBold size={16} aria-hidden="true" />
            ) : (
              <Bookmark size={16} aria-hidden="true" />
            )}
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
              // While a countdown shows, the name says what it is for; the
              // label itself is only the time left (one fixed width, A7).
              aria-label={
                fetching
                  ? undefined
                  : rateLimitSeconds > 0
                    ? `${remainingLabel(rateLimitSeconds * 1000)} 뒤 갱신`
                    : cooling
                      ? `${remainingLabel(window_.remainingMs)} 뒤 갱신`
                      : undefined
              }
            >
              {fetching ? (
                <InlineOrb />
              ) : (
                <RefreshArrow size={14} aria-hidden="true" />
              )}
              {/* One width for "갱신" and every countdown ("3분 30초", "3분 9초",
                  "30초" when too many requests): the ticking label never moves
                  the buttons beside it (A6·A7). */}
              {/* Drawn anew when the text changes: centred text rewritten in place
                  starts elsewhere ("17초" → "7초") and counts as moving. */}
              <span key={label} className={styles.refreshLabel}>
                {label}
              </span>
            </button>
            <span role="tooltip" id={tooltipId} className={styles.tooltip}>
              {relativeAgo(window_.ageMs)} 갱신 · {kstTime(window_.fetchedAt)}
              <br />
              {rateLimitSeconds > 0
                ? `요청이 많아 ${remainingLabel(rateLimitSeconds * 1000)} 뒤 다시 갱신할 수 있어요`
                : cooling
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
  // The remaining official tooltip lines, loaded once the page is idle.
  const extra = useItemTooltips(data.characterName);
  const extraOf = (item: Equipment) =>
    equipmentExtra(extra, data.loadout.equipment.indexOf(item), item.type);
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
                <li key={i} {...stagger(i, styles.item)}>
                  <ItemTooltip item={item} slot={SLOT_LABEL[item.type ?? ""] ?? undefined} extra={extraOf(item)}>
                    <GameIcon src={item.icon} grade={item.grade} />
                  </ItemTooltip>
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
                </li>
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
              <li key={i} {...stagger(i, styles.item)}>
                <ItemTooltip item={item} extra={extraOf(item)}>
                  <GameIcon src={item.icon} grade={item.grade} />
                </ItemTooltip>
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
                  {/* No ark passive point badge here (user 10-26): it reads as an
                      accessory effect; the point stays in the item tooltip. */}
                  <span className={styles.badges}>
                    <Quality value={item.detail?.quality} />
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
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={styles.equipFoot}>
        {groups.stone && (
          <div className={styles.footItem}>
            <ItemTooltip item={groups.stone} slot="어빌리티 스톤" extra={extraOf(groups.stone)}>
              <GameIcon
                src={groups.stone.icon}
                grade={groups.stone.grade}
                size={40}
              />
            </ItemTooltip>
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
          </div>
        )}
        {groups.bracelet && (
          <div className={styles.footItem} data-wide="">
            <ItemTooltip item={groups.bracelet} slot="팔찌" extra={extraOf(groups.bracelet)}>
              <GameIcon
                src={groups.bracelet.icon}
                grade={groups.bracelet.grade}
                size={40}
              />
            </ItemTooltip>
            <BraceletBody
              name={text(groups.bracelet.name)}
              effects={groups.bracelet.detail?.braceletEffects ?? []}
              efficiency={data.braceletEfficiency}
            />
          </div>
        )}
        {groups.others.map((item, i) => (
          <div key={i} className={styles.footItem}>
            <ItemTooltip item={item} slot={item.type ?? undefined} extra={extraOf(item)}>
              <GameIcon src={item.icon} grade={item.grade} size={40} />
            </ItemTooltip>
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

/**
 * The bracelet's effects with 팔찌 효율 (backend #571, user decision: the
 * comparison sites' damage share, not the combat-power contribution shown
 * before): how much this bracelet adds to damage. A dealer gets the value and,
 * when sent, the '악마 피해' setting (off by default) for the value with it; a
 * supporter sees the grades only; not worked out reads '준비 중'. The term
 * carries its definition (A22).
 */
function BraceletBody({
  name,
  effects,
  efficiency: given,
}: {
  name: string;
  effects: { text: string; grade: unknown }[];
  efficiency: Character["braceletEfficiency"];
}) {
  // Off on this deployment: as if there were no efficiency (nothing drawn).
  const real = braceletRealView(useContext(CharacterEfficiencyEnabled) ? given?.real : null);
  const [devil, setDevil] = useState(false);
  return (
    <div className={styles.braceletBody}>
      <strong>팔찌</strong>
      {(real.state === "ready" || real.state === "pending" || real.state === "unavailable") && (
        <p className={styles.braceletEffHead}>
          <Tooltip>
            <TooltipTrigger className={styles.braceletEffTerm} aria-label="팔찌 효율: 이 팔찌가 딜을 몇 % 올려 주는지예요.">
              팔찌 효율
            </TooltipTrigger>
            <TooltipContent>이 팔찌가 딜을 몇 % 올려 주는지예요.</TooltipContent>
          </Tooltip>
          {real.state === "ready" ? (
            <b>{devil && real.devil ? real.devil : real.percent}</b>
          ) : real.state === "unavailable" ? (
            // Read but not worked out (an option the engine does not know):
            // why, in a fixed sentence — not '준비 중', which reads as 'soon'.
            <span className={styles.braceletEffReason}>읽지 못한 팔찌 옵션이 있어 계산하지 않았어요</span>
          ) : (
            // A bracelet is there (this row only shows with one), its value not
            // worked out: never a number (PM 총괄 14:04 — the comparison site
            // shows a meaningless constant here); '준비 중' as everywhere else.
            <span className={styles.braceletEffReason}>준비 중</span>
          )}
          {real.state === "ready" && real.devil && (
            <button
              type="button"
              className={styles.textButton}
              aria-pressed={devil}
              onClick={() => setDevil(!devil)}
            >
              악마 피해
            </button>
          )}
        </p>
      )}
      {effects.length ? (
        <ul className={styles.gradeList} data-flow="">
          {effects.map((effect, i) => (
            <GradeLine key={i} grade={effect.grade}>
              <span className={styles.preLine}>{effect.text}</span>
            </GradeLine>
          ))}
        </ul>
      ) : (
        <small>{name}</small>
      )}
    </div>
  );
}

/**
 * 아크 그리드 효율 (backend #570, user decision: the comparison sites' damage
 * share, not the combat-power contribution shown before): how much the ark
 * grid gems add — their options and the core points above 17 — with 질서·혼돈
 * apart and each option line behind "줄별 보기". No grid: 0% (its gems add
 * nothing, PM-프론트 P3); a grid not worked out: '준비 중'. The term carries
 * its definition (A22).
 */
function ArkRealHead({ view }: { view: ArkGridRealView }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (view.state === "hidden") return null;
  return (
    <>
      <p className={styles.braceletEffHead}>
        <Tooltip>
          <TooltipTrigger
            className={styles.braceletEffTerm}
            aria-label="아크 그리드 효율: 아크 그리드 젬(옵션·코어 포인트)이 딜을 몇 % 올려 주는지예요."
          >
            아크 그리드 효율
          </TooltipTrigger>
          <TooltipContent>아크 그리드 젬(옵션·코어 포인트)이 딜을 몇 % 올려 주는지예요.</TooltipContent>
        </Tooltip>
        {view.state === "ready" ? (
          <>
            <b>{view.total}</b>
            {view.parts && <small className={styles.arkEffCores}>{view.parts}</small>}
          </>
        ) : view.state === "none" ? (
          <span className={styles.braceletEffReason}>0% · 아크 그리드 없음</span>
        ) : (
          <span className={styles.braceletEffReason}>준비 중</span>
        )}
        {view.state === "ready" && view.lines.length > 0 && (
          <button
            type="button"
            className={styles.textButton}
            aria-expanded={open}
            aria-controls={listId}
            aria-label={open ? "아크 그리드 젬 옵션 줄별 접기" : "아크 그리드 젬 옵션 줄별 보기"}
            onClick={() => setOpen(!open)}
          >
            {open ? "줄별 접기" : "줄별 보기"}
          </button>
        )}
      </p>
      {view.state === "ready" && view.series.length > 0 && (
        <p className={styles.arkRealSeries}>
          {view.series.map((s) => (
            <span key={s.label}>
              {s.label} <b>{s.percent}</b>
            </span>
          ))}
        </p>
      )}
      {view.state === "ready" && open && (
        <ul id={listId} className={styles.arkRealLines}>
          {view.lines.map((line) => (
            <li key={line.name}>
              <span>
                {line.name}
                {line.level != null && <small> Lv.{line.level}</small>}
              </span>
              {line.percent ? <b>{line.percent}</b> : <small>계산하지 않는 줄이에요.</small>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * A group of share bars (원정대 구성): label, a bar as wide as the share, and
 * "n명 · x%". Shares add up to 100.0 exactly (roster-list.shares). The bar is
 * drawn once at its width, no animation.
 */
function ShareBars({ title, rows }: { title: string; rows: { label: string; count: number; percent: number }[] }) {
  return (
    <section className={styles.shareBars} aria-label={title}>
      <h3>{title}</h3>
      <ul>
        {rows.map((row) => (
          <li key={row.label}>
            <span>{row.label}</span>
            <span className={styles.shareTrack} aria-hidden="true">
              <span style={{ width: `${row.percent}%` }} />
            </span>
            <span className={styles.shareValue}>
              {row.count}명 · {row.percent.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GemsPanel({ data }: { data: Character }) {
  const stagger = useStagger();
  const gems = data.loadout.gems?.items ?? [];
  const skills = data.loadout.gems?.effects?.skills ?? [];
  const extra = useItemTooltips(data.characterName);
  const summary = data.analysis.gems;
  const baseAttack = gemBaseAttack(data.loadout.gems?.effects?.description);
  const emptySlots = gemCounts(data.loadout.gems).empty;
  return (
    <Panel
      title="보석"
      meta={
        summary && gems.length
          ? [
              `평균 ${number(summary.averageLevel)}`,
              `겁 ${summary.damageEffectCount}`,
              `작 ${summary.cooldownEffectCount}`,
              // Empty slots only when there are some (players read '미장착 1').
              emptySlots > 0 && `미장착 ${emptySlots}`,
              baseAttack != null && `기본 공격력 +${baseAttack}%`,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
    >
      {gems.length ? (
        <ul className={styles.gemGrid}>
          {gems.map((gem, i) => {
            const skill = skills.find((effect) => effect.gemSlot === gem.slot);
            // Players read gems as "10겁 8작"; the official name stays in the card.
            const kind = gemKind(gem.name, skill?.description);
            return (
              <li key={i} {...stagger(i)}>
                <DetailTooltip
                  name={gem.name ?? "보석"}
                  card={
                    <GemCard
                      gem={gem}
                      skill={skill}
                      className={data.className}
                      lines={gemLines(extra, gem.slot)}
                    />
                  }
                >
                  <GameIcon src={gem.icon} grade={gem.grade} size={44} />
                </DetailTooltip>
                <span data-gem={kind ? (isCooldownGem(kind) ? "cooldown" : "damage") : undefined}>
                  {gem.level != null && gem.level > 0 ? gem.level : "?"}
                  {kind ?? ""}
                </span>
                <small className={styles.srOnly}>{text(gem.name)}</small>
              </li>
            );
          })}
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
  const extra = useItemTooltips(data.characterName);
  // Off on this deployment: as if there were no efficiency (nothing drawn).
  const real = arkGridRealView(
    useContext(CharacterEfficiencyEnabled) ? data.arkGridEfficiency?.real : null,
    !!grid && grid.slots.length > 0,
  );
  if (!grid)
    return (
      <Panel title="아크 그리드">
        <ArkRealHead view={real} />
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
        </span>
      }
    >
      <ArkRealHead view={real} />
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
          {grid.slots.map((slot, i) => {
            const lines = gridLines(extra, i);
            const detail = slot.options.length > 0 || slot.gems.some((gem) => gem.name);
            return (
              <li key={i}>
                <details open={expanded || undefined} className={`${styles.core} ${expand.expand}`}>
                  <summary>
                    <DetailTooltip name={slot.name ?? "아크 그리드 코어"} card={<CoreCard slot={slot} lines={lines} />}>
                      <GameIcon src={slot.icon} grade={slot.grade} size={40} />
                    </DetailTooltip>
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
                        <DetailTooltip
                          key={j}
                          name={gem.name ?? "아크 그리드 젬"}
                          card={<GridGemCard gem={gem} lines={gridGemLines(lines, j)} />}
                          hit="tight"
                        >
                          <GameIcon src={gem.icon} grade={gem.grade} size={24} inactive={gem.active === false} />
                        </DetailTooltip>
                      ))}
                    </span>
                    {/* Each core opens on its own; the arrow turns over (user 10-12). */}
                    {detail && <ChevronDown size={16} className={styles.coreChevron} aria-hidden="true" />}
                  </summary>
                  {detail && (
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
                              <DetailTooltip
                                name={gem.name ?? "아크 그리드 젬"}
                                card={<GridGemCard gem={gem} lines={gridGemLines(lines, j)} />}
                                hit="row"
                              >
                                <GameIcon src={gem.icon} grade={gem.grade} size={28} />
                              </DetailTooltip>
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
            );
          })}
        </ul>
      ) : (
        <Empty state={data.coverage.arkGrid.collections.slots} />
      )}
      {/* Every core at once, under the list (user 10-11); the head button
          went away because it did the same (user 10-12). */}
      {hasDetail && grid.slots.length > 0 && (
        <button
          type="button"
          className={styles.gridToggle}
          aria-expanded={expanded}
          aria-label={expanded ? "아크 그리드 코어 전체 접기" : "아크 그리드 코어 전체 펼치기"}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDown size={18} aria-hidden="true" />
          <span aria-hidden="true">{expanded ? "접기" : "펼치기"}</span>
        </button>
      )}
    </Panel>
  );
}

function CardsPanel({ data }: { data: Character }) {
  const stagger = useStagger();
  const [folded, setFolded] = useState(false);
  const gridId = useId();
  const cards = data.loadout.cards;
  const summary = data.analysis.cards;
  return (
    <Panel
      title="카드"
      meta={summary ? `각성 합 ${summary.knownAwakeningTotal}` : undefined}
      // Folds the card pictures only (#1101): set effects and the collection
      // stay. Open by default, as before.
      action={
        cards?.items.length ? (
          <button
            type="button"
            className={`${styles.foldButton} hit-44`}
            aria-expanded={!folded}
            aria-controls={gridId}
            onClick={() => setFolded((value) => !value)}
          >
            {/* Both labels in one cell, one shown: the same width either way,
                so the head never reflows when it is pressed (A7). */}
            <span className={styles.foldLabels}>
              <span data-on={!folded || undefined}>카드 접기</span>
              <span data-on={folded || undefined}>카드 펴기</span>
            </span>
          </button>
        ) : undefined
      }
    >
      {cards?.items.length ? (
        <>
          <ul id={gridId} className={styles.cardGrid} hidden={folded}>
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
  pointsOnly = false,
}: {
  data: Character;
  detailed?: boolean;
  /** The ark passive tab lists the nodes itself: points only (no repeat). */
  pointsOnly?: boolean;
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
          <Link href="?tab=arkpassive" replace>
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
      {!pointsOnly && trees.map(({ tree, nodes }) =>
        nodes.length ? (
          <div key={tree} className={styles.tree}>
            <h3>{tree}</h3>
            <ul>
              {nodes.map(({ effect, parsed }, i) => (
                <li key={i}>
                  <DetailTooltip
                    name={parsed.node ?? tree}
                    card={
                      <PassiveNodeCard
                        name={parsed.node ?? tree}
                        tree={tree}
                        level={parsed.level}
                        icon={effect.icon}
                        text={sourcePlainText(effect.effect ?? effect.description) || null}
                      />
                    }
                  >
                    <GameIcon src={effect.icon} size={28} />
                  </DetailTooltip>
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
      {/* 특성 자세히 (§14.1 ④): the cards with the official lines, in a sheet. */}
      {data.stats.some((stat) => stat.tooltip.length) && (
        <div className={styles.statDetail}>
          <StatSheet stats={data.stats} total={total} />
        </div>
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
              {effect.description ? (
                <DetailTooltip name={effect.name ?? "각인"} card={<EngravingCard description={effect.description} />}>
                  <strong>{text(effect.name)}</strong>
                </DetailTooltip>
              ) : (
                <strong>{text(effect.name)}</strong>
              )}
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

const ATTACK_LABEL: Record<string, string> = { BACK_ATTACK: "백 어택", HEAD_ATTACK: "헤드 어택" };

type SkillGem = ReturnType<typeof skillGems>[number];

const seconds = (value: number) => `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}초`;

/**
 * 보석 반영 쿨타임 (backend #378, checklist K20): the official cooldown and
 * the equipped gems' reduction only, nothing else (engravings, swiftness are
 * not in it), so the basis sentence rides along as the term's tooltip.
 */
function SkillCooldown({ cooldown }: { cooldown: NonNullable<Skill["cooldown"]> }) {
  const reduced = cooldown.gemCooldownReductionPct > 0;
  return (
    <p className={styles.skillCooldown}>
      <Tooltip>
        <TooltipTrigger className={styles.braceletEffTerm} aria-label={`쿨타임: ${cooldown.basis}`}>
          쿨타임
        </TooltipTrigger>
        <TooltipContent>{cooldown.basis}</TooltipContent>
      </Tooltip>
      {reduced ? (
        <>
          <span className={styles.skillCooldownFrom}>{seconds(cooldown.cooldownSec)}</span>
          <span aria-hidden="true">→</span>
          <b>{seconds(cooldown.cooldownWithGemsSec)}</b>
          <small>보석 {cooldown.gemCooldownReductionPct.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}% 감소</small>
        </>
      ) : (
        <b>{seconds(cooldown.cooldownSec)}</b>
      )}
    </p>
  );
}

function SkillCard({
  skill,
  compact,
  rune,
  gems = [],
  className,
  gemLinesOf,
  lines,
  levelOf,
}: {
  skill: Skill;
  compact?: boolean;
  rune?: string[];
  /** Gems on this skill (full view): chips that open the gem card. */
  gems?: SkillGem[];
  className?: string;
  gemLinesOf?: (slot: number | null) => string[];
  /** Official tooltip lines (backend #300): the card's lines and the stagger chip. */
  lines?: SkillLines;
  /** Tripod level from the official armory page (backend flag on), else null. */
  levelOf?: (tier: number | null, slot: number | null) => number | null;
}) {
  const stagger = staggerOf(lines?.infoLines);
  // The cooldown line already says "보석 n% 감소": the cooldown gem's own
  // effect row would say it again (PM-프론트 #650 P2), so it stays in the gem
  // chip's card only. Damage rows and rows without the line stay.
  const cooled = !compact && skill.cooldown != null && skill.cooldown.gemCooldownReductionPct > 0;
  const gemEffects = cooled ? skill.gemEffects.filter((effect) => effect.kind !== "COOLDOWN") : skill.gemEffects;
  // Full view: chips (type, attack direction, counter,
  // part break, gems); compact keeps the one-line summary. The stagger chip
  // comes from the official tooltip lines, which can land after the card is
  // painted: it goes last so its arrival moves no other chip (A6).
  const chips = compact
    ? []
    : [
        skill.type,
        skill.attackType ? ATTACK_LABEL[skill.attackType] : null,
        skill.counter ? "카운터" : null,
        skill.partBreakLevel != null ? `파괴 ${skill.partBreakLevel}` : null,
        stagger ? `무력 ${stagger}` : null,
      ].filter((chip): chip is string => chip != null);
  return (
    <li className={styles.skill}>
      <div className={styles.skillHead}>
        <DetailTooltip name={skill.name ?? "스킬"} card={<SkillDetailCard skill={skill} lines={lines} />}>
          <GameIcon src={skill.icon} size={36} />
        </DetailTooltip>
        <div className={styles.itemText}>
          <strong>{text(skill.name)}</strong>
          <small>
            {level(skill.level)}
            {skill.rune && ` · ${text(skill.rune.name)}`}
            {compact && skill.partBreakLevel != null &&
              ` · 부위 파괴 Lv.${skill.partBreakLevel}`}
            {compact && skill.counter && " · 카운터"}
          </small>
        </div>
        {gems.length > 0 && (
          <span className={styles.skillGems} aria-label="보석">
            {gems.map(({ gem, effect, label, cooldown }) => (
              <span key={`gem-${gem.slot}`} data-gem={cooldown ? "cooldown" : "damage"}>
                <DetailTooltip
                  name={gem.name ?? "보석"}
                  card={
                    <GemCard gem={gem} skill={effect} className={className ?? ""} lines={gemLinesOf?.(gem.slot) ?? []} />
                  }
                >
                  <span>{label}</span>
                </DetailTooltip>
              </span>
            ))}
          </span>
        )}
        {skill.rune && (
          <DetailTooltip name={skill.rune.name ?? "스킬 룬"} card={<RuneCard rune={skill.rune} lines={rune} />}>
            <GameIcon src={skill.rune.icon} grade={skill.rune.grade} size={24} />
          </DetailTooltip>
        )}
      </div>
      {!compact && skill.cooldown && <SkillCooldown cooldown={skill.cooldown} />}
      {chips.length > 0 && (
        <ul className={styles.skillChips} aria-label="스킬 정보">
          {chips.map((chip) => (
            <li key={chip}>{chip}</li>
          ))}
        </ul>
      )}
      {skill.tripods.length > 0 && (
        <ul className={styles.tripods}>
          {skill.tripods.map((tripod, i) => {
            const tripodLv = compact ? null : levelOf?.(tripod.tier, tripod.slot) ?? null;
            return (
              <li key={i}>
                <span className={styles.tripodIcon}>
                  <GameIcon src={tripod.icon} size={20} />
                  {tripodLv != null && <b aria-hidden="true">{tripodLv}</b>}
                </span>
                {compact ? null : (
                  <span>
                    {text(tripod.name)}
                    {tripodLv != null && <span className={styles.srOnly}> 레벨 {tripodLv}</span>}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!compact && gemEffects.length > 0 && (
        <ul className={styles.gemEffects}>
          {gemEffects.map((effect, i) => (
            <li key={i} data-kind={effect.kind ?? undefined}>
              {effect.text}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

const GEM_FILTERS = [
  { id: "all", label: "전체" },
  { id: "both", label: "둘 다" },
  { id: "damage", label: "겁화만" },
  { id: "cooldown", label: "작열만" },
  { id: "none", label: "미장착" },
] as const;
type GemFilter = (typeof GEM_FILTERS)[number]["id"];

function SkillOverview({
  data,
  full = false,
  armory,
}: {
  data: Character;
  full?: boolean;
  /** Official armory page details (skill tab, backend flag on). */
  armory?: ArmoryPage;
}) {
  const [showAll, setShowAll] = useState(false);
  const [gemFilter, setGemFilter] = useState<GemFilter>("all");
  // The skill rows keep their tallest height: a narrower gem filter does not
  // pull up what is under them (stacked, the side panels too) (A7).
  const [listRef, listHeight] = useTallest();
  const listId = useId();
  const otherId = useId();
  const skills = data.loadout.skills;
  const extra = useItemTooltips(data.characterName);
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
  // Full view: highest skill level first, as the reference lists them.
  const shown = full && showAll ? skills : summary.active;
  const sorted = full ? [...shown].sort((a, b) => (b.level ?? 0) - (a.level ?? 0)) : shown;
  const gemsOf = (skill: Skill) => skillGems(data.loadout.gems, skill.name);
  // Gems on skills no row shows (identity and the like), listed under the
  // skills whatever the filter (L34). Against every skill, not only the
  // ones in use, so a gem on an unused listed skill stays on its row.
  const others = full ? otherSkillGems(data.loadout.gems, skills.map((skill) => skill.name)) : [];
  // One group per skill, so the groups never overlap (PM #507 P1): both kinds,
  // damage only, cooldown only, none. The head counts the same chips.
  const groupOf = (skill: Skill): GemFilter => {
    const chips = gemsOf(skill);
    const damage = chips.some((gem) => !gem.cooldown);
    const cooldown = chips.some((gem) => gem.cooldown);
    return damage && cooldown ? "both" : damage ? "damage" : cooldown ? "cooldown" : "none";
  };
  const groupCount = (id: GemFilter) => (id === "all" ? sorted.length : sorted.filter((skill) => groupOf(skill) === id).length);
  const list = !full || gemFilter === "all" ? sorted : sorted.filter((skill) => groupOf(skill) === gemFilter);
  const chips = sorted.flatMap((skill) => gemsOf(skill));
  const counts = {
    damage: chips.filter((gem) => !gem.cooldown).length,
    cooldown: chips.filter((gem) => gem.cooldown).length,
    empty: gemCounts(data.loadout.gems).empty,
  };
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
              <Link href="?tab=skills" replace>
                자세히
              </Link>
            </>
          )}
        </>
      }
    >
      {full && (
        <div className={styles.gemFilterRow}>
          <p className={styles.gemCounts}>
            <span data-gem="damage">겁화 {counts.damage}</span>
            <span data-gem="cooldown">작열 {counts.cooldown}</span>
            <span>빈 칸 {counts.empty}</span>
          </p>
          <div className={styles.filterRow} role="group" aria-label="보석으로 거르기">
            {GEM_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={gemFilter === item.id}
                onClick={() => setGemFilter(item.id)}
              >
                {item.label} {groupCount(item.id)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div ref={listRef} className={styles.heldList} style={listHeight ? { minHeight: listHeight } : undefined}>
        {list.length ? (
          <ul id={listId} className={styles.skillGrid} data-compact={!full || undefined}>
            {list.map((skill, i) => (
              <SkillCard
                key={`${skill.name}-${i}`}
                skill={skill}
                compact={!full}
                rune={runeLines(extra, skill.name)}
                gems={full ? gemsOf(skill) : undefined}
                className={data.className}
                gemLinesOf={(slot) => gemLines(extra, slot)}
                lines={skillLines(extra, skill.name)}
                levelOf={armory ? (tier, slot) => tripodLevel(armory, skill.name, tier, slot) : undefined}
              />
            ))}
          </ul>
        ) : (
          <Empty state={data.coverage.skills} />
        )}
      </div>
      {others.length > 0 && (
        <div className={styles.otherGems}>
          <h3 id={otherId}>그 외 장착 보석</h3>
          <ul aria-labelledby={otherId}>
            {others.map(({ gem, effect, label, cooldown }) => (
              <li key={`other-${gem.slot}`}>
                <span className={styles.skillGems}>
                  <span data-gem={cooldown ? "cooldown" : "damage"}>
                    <DetailTooltip
                      name={gem.name ?? "보석"}
                      card={
                        <GemCard gem={gem} skill={effect} className={data.className ?? ""} lines={gemLines(extra, gem.slot)} />
                      }
                    >
                      <span>{label}</span>
                    </DetailTooltip>
                  </span>
                </span>
                <span>{text(effect.name)}</span>
              </li>
            ))}
          </ul>
        </div>
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
        {/* 순위 → 특성 → 각인 → 아크 패시브 → 조회수 (v0.3.2): the rank stays
            on top where it has always been (user 10-25), then the official
            order. The rank block holds its height while it loads, so nothing
            under it moves. */}
        <aside className={styles.stack} aria-label="요약">
          <RankPanel name={data.characterName} />
          <StatsPanel data={data} />
          <EngravingsPanel data={data} />
          <ArkPassiveSummary data={data} />
          <ViewsPanel name={data.characterName} />
        </aside>
      </div>
      <SkillOverview data={data} />
    </div>
  );
}

export function SkillsTab({ data }: { data: Character }) {
  const skills = data.loadout.skills ?? [];
  const summary = skillSummary(skills);
  const extra = useItemTooltips(data.characterName);
  const armory = useArmoryPage(data.characterName);
  const counters = summary.active.filter((skill) => skill.counter === true);
  const staggers = summary.active.filter((skill) => staggerOf(skillLines(extra, skill.name)?.infoLines)).length;
  const points = data.skillPoints;
  const left = points?.used != null && points.total != null ? points.total - points.used : null;
  // The two highest combat stats ("특화 1816 · 치명 576"), the engravings by
  // first letter, and the class engraving (ark passive title).
  const topStats = COMBAT_STATS.map((type) => ({ type, value: statNumber(data.stats, type) }))
    .filter((stat): stat is { type: string; value: number } => stat.value != null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 2);
  const engravings = data.loadout.engravings?.arkPassiveEffects ?? [];
  const short = engravings.map((engraving) => (engraving.name ?? "").slice(0, 1)).join("");
  const classEngraving = data.loadout.arkPassive?.title;
  const ratio = points?.used != null && points.total ? Math.min(1, points.used / points.total) : 0;
  // Two pieces on the ring: used (blue) and left (amber), with small gaps.
  // The left piece never shrinks below 4% so 478/483 still shows it (user 10-11).
  const gap = 0.02;
  const leftShare = ratio >= 1 ? 0 : Math.max(1 - ratio, 0.04);
  const usedShare = ratio <= 0 ? 0 : leftShare ? 1 - leftShare - gap * 2 : 1;
  return (
    <div className={styles.layout}>
      <div className={styles.skillHeadRow}>
        <Panel title="정보" meta={armory?.skillCode ? <SkillCodeCopy code={armory.skillCode} /> : undefined}>
          <dl className={styles.skillInfo}>
            {topStats.length > 0 && (
              <div>
                <dt>특성</dt>
                <dd>{topStats.map((stat) => `${stat.type} ${number(stat.value)}`).join(" · ")}</dd>
              </div>
            )}
            {short && (
              <div>
                <dt>각인</dt>
                <dd title={engravings.map((engraving) => engraving.name).join(", ")}>
                  {short}
                  <span className={styles.srOnly}> ({engravings.map((engraving) => engraving.name).join(", ")})</span>
                </dd>
              </div>
            )}
            {classEngraving && (
              <div>
                <dt>직업 각인</dt>
                <dd>{classEngraving}</dd>
              </div>
            )}
          </dl>
        </Panel>
        <Panel title="스킬 포인트">
          {points?.used != null && points.total != null ? (
            <div className={styles.spRing}>
              <svg viewBox="0 0 64 64" role="img" aria-label={`스킬 포인트 ${points.used} / ${points.total}`}>
                {usedShare > 0 && (
                  <circle
                    cx="32"
                    cy="32"
                    r="27"
                    className={styles.spFill}
                    pathLength={1}
                    strokeDasharray={`${usedShare} 1`}
                  />
                )}
                {leftShare > 0 && (
                  <circle
                    cx="32"
                    cy="32"
                    r="27"
                    className={styles.spLeft}
                    pathLength={1}
                    strokeDasharray={`${leftShare} 1`}
                    strokeDashoffset={-(usedShare + (usedShare > 0 ? gap : 0))}
                  />
                )}
              </svg>
              <p>
                <b>{number(points.used)}</b> / {number(points.total)}
                <small>남은 포인트 {number(left)}</small>
              </p>
            </div>
          ) : (
            <p className={styles.muted}>스킬 포인트 정보가 없어요.</p>
          )}
        </Panel>
        <Panel title="요약">
          <dl className={styles.skillCounts}>
            <div>
              <dt>카운터</dt>
              <dd>{counters.length}개</dd>
            </div>
            <div>
              <dt>무력화</dt>
              <dd>{staggers}개</dd>
            </div>
            <div>
              <dt>부위 파괴</dt>
              <dd>{summary.partBreakCount}개</dd>
            </div>
          </dl>
        </Panel>
      </div>
      <div className={styles.columns}>
        <SkillOverview data={data} full armory={armory} />
        <aside className={styles.stack} aria-label="스킬 요약">
          <Panel title="카운터 스킬" meta={`${counters.length}개`}>
            {counters.length ? (
              <ul className={styles.counterList}>
                {counters.map((skill, i) => (
                  <li key={`${skill.name}-${i}`}>
                    <GameIcon src={skill.icon} size={24} />
                    <span>{text(skill.name)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>사용 중인 카운터 스킬이 없어요.</p>
            )}
          </Panel>
          <Panel title="스킬 효과">
            <dl className={styles.statGrid}>
              <div>
                <dt>부위 파괴</dt>
                <dd>
                  {summary.partBreakLevel != null
                    ? `합계 Lv.${summary.partBreakLevel} × ${summary.partBreakCount}`
                    : "-"}
                </dd>
              </div>
            </dl>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/**
 * Copies the skill code (official armory page, backend flag on) for pasting
 * in the game's skill code window; says so for a moment, also to screen readers.
 */
function SkillCodeCopy({ code }: { code: string }) {
  const [status, setStatus] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setStatus("스킬 코드를 복사했어요.");
    } catch {
      setStatus("복사하지 못했어요. 다시 눌러 주세요.");
    }
    window.setTimeout(() => setStatus(""), 2_000);
  }
  return (
    <div className={styles.skillCode}>
      <button type="button" className={styles.textButton} onClick={copy}>
        스킬 코드 복사
      </button>
      <span role="status" className={styles.muted}>
        {status}
      </span>
    </div>
  );
}

/**
 * Ark passive as the reference lays it out: one tree at a time picked by its
 * points (진화 140 · 깨달음 101 · 도약 70), its rank and level total and the
 * active nodes row by tier; then every tree's active effects side by side.
 * Inactive nodes (the full grid) need each class's whole tree from the
 * backend and come later.
 */
export function ArkPassiveTab({ data }: { data: Character }) {
  const trees = passiveByTree(data);
  const [picked, setPicked] = useState<string | null>(null);
  const tree = picked ?? trees.find((item) => item.nodes.length)?.tree ?? ARK_TREES[0];
  const current = trees.find((item) => item.tree === tree) ?? trees[0];
  const tiers = [...new Set(current.nodes.map(({ parsed }) => parsed.tier ?? 0))].sort((a, b) => a - b);
  const card = (tree: string, { effect, parsed }: (typeof current.nodes)[number]) => (
    <PassiveNodeCard
      name={parsed.node ?? tree}
      tree={tree}
      level={parsed.level}
      icon={effect.icon}
      text={sourcePlainText(effect.effect ?? effect.description) || null}
    />
  );
  return (
    <div className={styles.layout}>
      <div className={styles.columns}>
        <div className={styles.stack}>
          <PillTabs
            aria-label="아크 패시브 트리"
            listClassName={styles.rosterViews}
            value={tree}
            onValueChange={(next) => setPicked(next as string)}
            panels={
              <PillTabsPanel value={tree}>
                <Panel
                  // Drawn anew per tree: the head text changes in place otherwise
                  // and counts as moving (A7).
                  key={tree}
                  title={`${tree} 노드`}
                  meta={[current.point?.description, `활성 ${current.nodes.length}개`].filter(Boolean).join(" · ")}
                >
                  {current.nodes.length ? (
                    tiers.map((tier) => (
                      <section key={tier} className={styles.passiveTier} aria-label={`${tier}티어`}>
                        <h3>{tier ? `${tier}티어` : "기타"}</h3>
                        <ul className={styles.passiveDetail}>
                          {current.nodes
                            .filter(({ parsed }) => (parsed.tier ?? 0) === tier)
                            .map((node, i) => (
                              <li key={i}>
                                <DetailTooltip name={node.parsed.node ?? tree} card={card(tree, node)}>
                                  <GameIcon src={node.effect.icon} size={36} />
                                </DetailTooltip>
                                <div className={styles.itemText}>
                                  <strong>
                                    {node.parsed.node} <small>Lv.{node.parsed.level}</small>
                                  </strong>
                                  <p>
                                    <SourceText value={node.effect.effect ?? node.effect.description} />
                                  </p>
                                </div>
                              </li>
                            ))}
                        </ul>
                      </section>
                    ))
                  ) : (
                    <p className={styles.muted}>이 트리에서 확인된 노드가 없어요.</p>
                  )}
                </Panel>
              </PillTabsPanel>
            }
          >
            {trees.map((item) => (
              <PillTab key={item.tree} value={item.tree}>
                {item.tree} {number(item.point?.value)}
              </PillTab>
            ))}
          </PillTabs>
          <Panel title="활성 효과" wide>
            <div className={styles.passiveColumns}>
              {trees.map((item) => (
                <section key={item.tree} aria-label={`${item.tree} 활성 효과`}>
                  <h3>{item.tree}</h3>
                  <p className={styles.passiveColumnMeta}>
                    {[item.point?.value != null ? `${number(item.point.value)}P` : null, item.point?.description]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {item.nodes.length ? (
                    <ul className={styles.passiveSummaryList}>
                      {item.nodes.map((node, i) => (
                        <li key={i}>
                          <DetailTooltip name={node.parsed.node ?? item.tree} card={card(item.tree, node)}>
                            <GameIcon src={node.effect.icon} size={24} />
                          </DetailTooltip>
                          <span>{node.parsed.node}</span>
                          {node.parsed.tier != null && <b>T{node.parsed.tier}</b>}
                          <small>Lv.{node.parsed.level}</small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.muted}>활성 노드가 없어요.</p>
                  )}
                </section>
              ))}
            </div>
          </Panel>
        </div>
        <aside className={styles.stack}>
          <ArkPassiveSummary data={data} detailed pointsOnly />
          <EngravingsPanel data={data} />
        </aside>
      </div>
    </div>
  );
}

type Sibling = NonNullable<Character["siblings"]>[number];

/**
 * The roster's characters by server (checklist L17·L18): sort (item level,
 * character level, name), a compact view, hiding names for screenshots, and
 * the six-man average with the 1,680+ count. Server panels keep the item
 * level order so switching the sort only reorders inside each server.
 */
function SiblingList({
  siblings,
  current,
  caption,
}: {
  siblings: Sibling[];
  current: string;
  /** When the roster was read, right under the lists. */
  caption?: ReactNode;
}) {
  // Combat power records (L19), records only: no official call until the
  // button. Sorted by combat power by default; until they arrive (or if they
  // fail) that is the item level order, and rows keep their place (key by
  // position), so the answer only changes the text in them (A6).
  const power = useQuery({
    queryKey: rosterPowerKey(current),
    queryFn: ({ signal }) => fetchRosterPower(current, signal),
    retry: 1,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const records = useMemo(
    () => (power.data ? powerByName(power.data.data) : new Map<string, PowerRecord>()),
    [power.data],
  );
  const refreshing = useRosterPowerRefreshing(current);
  const now = useClock(MINUTE);
  const [sort, setSort] = useState<RosterSort>("combatPower");
  const [compact, setCompact] = useState(false);
  const [masked, setMasked] = useState(false);
  const ids = { compact: useId(), masked: useId() };
  const sorted = sortSiblings(siblings, sort, records);
  const servers = [...new Set(sortSiblings(siblings, "itemLevel").map((sibling) => sibling.serverName))];
  const summary = rosterSummary(siblings);
  const stats = rosterStats(siblings);
  const bands = levelBands(siblings);
  const mix = classMix(siblings);
  const shown = (name: string) => (masked ? maskName(name) : name);
  return (
    <>
      <div className={styles.rosterTools}>
        {/* Up to 400px the pills fill the row with one-word names (four sorts
            in the system font are wider than a 360 screen); the full name
            stays the accessible name. */}
        <SegmentedControl
          aria-label="원정대 정렬"
          value={sort}
          onValueChange={(value) => setSort(value as RosterSort)}
          className="max-[400px]:w-full"
        >
          {ROSTER_SORTS.map((item) => (
            <SegmentedItem key={item.id} value={item.id} aria-label={item.label} className="max-[400px]:px-2">
              <span className="max-[400px]:hidden">{item.label}</span>
              <span className="hidden max-[400px]:inline">{item.short}</span>
            </SegmentedItem>
          ))}
        </SegmentedControl>
        <span className={styles.rosterSwitch}>
          <Switch id={ids.compact} checked={compact} onCheckedChange={setCompact} />
          <label htmlFor={ids.compact}>축약</label>
        </span>
        <span className={styles.rosterSwitch}>
          <Switch id={ids.masked} checked={masked} onCheckedChange={setMasked} />
          <label htmlFor={ids.masked}>닉네임 가리기</label>
        </span>
      </div>
      {/* The characters first (v0.3.2 feedback): the summaries, combat power,
          make-up and weekly gold follow under the lists. */}
      {servers.map((server) => (
        <Panel
          key={server}
          title={server}
          meta={`${sorted.filter((s) => s.serverName === server).length}명`}
          wide
        >
          <ul
            // Drawn anew when records arrive (or a read ends): rows rewritten
            // in place count as moving when their text starts elsewhere,
            // new rows do not (A6·A7).
            key={power.dataUpdatedAt}
            className={styles.siblingGrid}
            data-compact={compact || undefined}
            data-stale={refreshing || undefined}
            aria-busy={refreshing || undefined}
          >
            {sorted
              .filter((sibling) => sibling.serverName === server)
              .map((sibling, i) => {
                const isCurrent = sibling.characterName === current;
                const linkable =
                  !isCurrent && !characterNameError(sibling.characterName);
                const body = (
                  <>
                    <strong>{shown(sibling.characterName)}</strong>
                    <small>
                      {sibling.className} · Lv.{number(sibling.characterLevel)}
                    </small>
                    <b>{number(sibling.itemLevel)}</b>
                    <PowerLine
                      record={records.get(sibling.characterName)}
                      ready={power.isSuccess}
                      now={now}
                    />
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
      {caption}
      {summary.sixAverage != null && (
        <p className={styles.rosterSummary}>
          식스맨 평균 <b>{number(summary.sixAverage)}</b>
          {/* The ranking's rule (api #530); the server named when the roster spans several. */}
          <small>{` (${servers.length > 1 ? `${summary.sixServer} ` : ""}${sixBasis(summary.sixCount, "평균")})`}</small>
          {" · "}
          {number(ROSTER_TOTAL_MIN)} 이상 <b>{summary.highCount}명</b>
          {summary.highCount > 0 && (
            <small>
              {" "}
              (합 {number(summary.highSum)})
            </small>
          )}
        </p>
      )}
      <RosterPower name={current} siblings={siblings} records={records} query={power} />
      {stats.average != null && (
        <>
          <dl className={styles.rosterStats} aria-label="원정대 아이템 레벨">
            <div>
              <dt>캐릭터</dt>
              <dd>{number(stats.count)}개</dd>
            </div>
            <div>
              <dt>평균</dt>
              <dd>{number(stats.average)}</dd>
            </div>
            <div>
              <dt>중앙값</dt>
              <dd>{number(stats.median)}</dd>
            </div>
            <div>
              <dt>최고</dt>
              <dd>{number(stats.max)}</dd>
            </div>
            <div>
              <dt>최저</dt>
              <dd>{number(stats.min)}</dd>
            </div>
          </dl>
          <Panel title="구성" wide>
            <div className={styles.rosterMix}>
              <ShareBars title="아이템 레벨 구간" rows={bands} />
              <ShareBars title={`직업 ${mix.length}개`} rows={mix} />
            </div>
          </Panel>
        </>
      )}
      <WeeklyGoldPanel siblings={siblings} current={current} shown={shown} />
    </>
  );
}

/**
 * A roster row's combat power: the recorded value and how long ago it was
 * seen, or '전투력 기록 없음'. Blank (same height) while loading or when the
 * records could not be read.
 */
function PowerLine({
  record,
  ready,
  now,
}: {
  record: PowerRecord | undefined;
  ready: boolean;
  now: number | null;
}) {
  const seen = record?.observedAt ? Date.parse(record.observedAt) : NaN;
  return (
    <>
      <span className={styles.siblingPower}>
        {!ready
          ? "\u00a0"
          : record?.combatPower == null
            ? "전투력 기록 없음"
            : `전투력 ${number(record.combatPower)}${now != null && Number.isFinite(seen) ? ` · ${relativeAgo(Math.max(0, now - seen))} 확인` : ""}`}
      </span>
      {/* The highest combat power seen (L19, the ranking's value). Its own
          line is always there, so a value arriving never moves the row; no
          record (a stopped character too, B5) reads the same either way. */}
      <span className={styles.siblingBest}>
        {!ready ? "\u00a0" : record?.bestCombatPower == null ? "최고 전투력 기록 없음" : `최고 전투력 ${number(record.bestCombatPower)}`}
      </span>
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
          ? rateLimitCopy(info)
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
      {limit.limited && <RateLimitNote seconds={limit.seconds} buttonCounts />}
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
  // How many seen rosters had each title worn (api #314, L13·K11), same
  // conditions as the 통계 '칭호' tab's defaults. The list waits for it so a
  // share never lands into a line already drawn (A6); without it, no share.
  const sharesOn = useContext(TitleStatsEnabled);
  const shares = useQuery({
    queryKey: ["title-equip", titleEquipQuery({})],
    queryFn: ({ signal }) => fetchTitleEquip(titleEquipQuery({}), signal),
    enabled: sharesOn,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const shareOf = new Map((shares.data?.data.titles ?? []).map((title) => [title.title, title]));
  const fade = useCrossfade(query.isPending || (sharesOn && shares.isPending));
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
          <InfoCircle size={13} aria-hidden="true" />
          장착한 칭호만 기록해요. 날짜는 획득일이 아니라 LOAKraken이 처음 확인한 날이에요
        </span>
      </p>
      {query.isPending || (sharesOn && shares.isPending) ? (
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
                  <TitleShare title={shareOf.get(group.titles[0].title)} />
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
                      <small>
                        {title.recordedBy}
                        <TitleShare title={shareOf.get(title.title)} />
                      </small>
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

/** " · 장착 원정대 32.26%": the share of seen rosters wearing it, when known. */
function TitleShare({ title }: { title: EquippedTitle | undefined }) {
  if (!title || title.equippedPercent == null) return null;
  return <> · 장착 원정대 {equipShare(title)}</>;
}

const ROSTER_VIEWS = [
  { id: "characters", label: "캐릭터" },
  { id: "titles", label: "칭호" },
  { id: "cards", label: "카드 기록" },
  { id: "receipt", label: "영수증" },
] as const;
type RosterView = (typeof ROSTER_VIEWS)[number]["id"];

/**
 * The roster tab picks one view at a time with the same pill tabs as the
 * stats screen (user 10-11: "원정대" means the character list first, so the
 * titles, card record and receipt are one choice away). The choice lives in
 * ?view= so it can be shared and survives going back; characters is the
 * default (no parameter), and the receipt follows its release flag.
 */
export function SiblingsTab({ data }: { data: Character }) {
  const receipt = useContext(ReceiptEnabled);
  const views = ROSTER_VIEWS.filter((item) => item.id !== "receipt" || receipt);
  const asked = useSearchParams().get("view");
  const view: RosterView = views.find((item) => item.id === asked)?.id ?? "characters";
  const router = useRouter();
  // Every view keeps the tallest one's room, so a shorter view (or its
  // loading line) does not pull the footer up (A7).
  const [viewRef, viewHeight] = useTallest();
  const choose = (next: RosterView) => {
    const params = new URLSearchParams(window.location.search);
    if (next === "characters") params.delete("view");
    else params.set("view", next);
    router.replace(`?${params}`, { scroll: false });
  };
  return (
    <div className={styles.layout}>
      <PillTabs
        aria-label="원정대 보기"
        listClassName={styles.rosterViews}
        value={view}
        onValueChange={(next) => choose(next as RosterView)}
        panels={
          <PillTabsPanel value={view} className={styles.rosterPanel}>
            <div ref={viewRef} style={viewHeight ? { minHeight: viewHeight } : undefined}>
              {view === "characters" ? (
                <RosterCharacters data={data} />
              ) : view === "titles" ? (
                <RosterTitlesPanel name={data.characterName} />
              ) : view === "cards" ? (
                <Panel title="카드 기록" wide>
                  <CardCollection name={data.characterName} />
                </Panel>
              ) : (
                <ReceiptPanel name={data.characterName} />
              )}
            </div>
          </PillTabsPanel>
        }
      >
        {views.map((item) => (
          <PillTab key={item.id} value={item.id}>
            {item.label}
          </PillTab>
        ))}
      </PillTabs>
    </div>
  );
}

function RosterCharacters({ data }: { data: Character }) {
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
    return embedded.length ? (
      <SiblingList siblings={embedded} current={data.characterName} />
    ) : (
      <Panel title="원정대" wide>
        <Empty state={data.coverage.siblings} />
      </Panel>
    );
  const result = query.data?.data;
  return (
    <>
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
          <SiblingList
            siblings={result.siblings}
            current={data.characterName}
            // Under the lists, not over them: the first card sits higher at
            // 360 (v0.3.2), the time still right by the characters it is of.
            caption={
              <p className={styles.caption}>
                원정대 갱신 {kstTime(result.fetchedAt)}
                {result.refreshAvailableAt &&
                  ` · ${kstTime(result.refreshAvailableAt)} 이후 다시 갱신`}
              </p>
            }
          />
        </>
      ) : (
        <Panel title="원정대" wide>
          <p className={styles.muted}>원정대 캐릭터가 없어요.</p>
        </Panel>
      )}
    </>
  );
}

/**
 * 현재 · 최고 · 변화 over a history chart (character screen checklist, 통계 탭
 * 3칸). Always three cells, also while loading (blank) and with one record
 * ("—" for the change), so the chart under them never moves.
 */
function HistoryCells({ summary }: { summary?: ReturnType<typeof historySummary> }) {
  const delta = summary?.delta;
  return (
    <dl className={styles.historyCells}>
      <div>
        <dt>현재</dt>
        <dd>{summary ? number(summary.current) : "\u00a0"}</dd>
      </div>
      <div>
        <dt>최고</dt>
        <dd>{summary ? number(summary.best) : "\u00a0"}</dd>
      </div>
      <div>
        <dt>변화</dt>
        <dd data-direction={delta == null || delta === 0 ? undefined : delta > 0 ? "up" : "down"}>
          {!summary ? "\u00a0" : delta == null ? "—" : delta === 0 ? "0" : `${delta > 0 ? "▲" : "▼"}${number(Math.abs(delta))}`}
        </dd>
      </div>
    </dl>
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
  // Minute clock (null until hydrated) for "~ 오늘 · N일".
  const now = useClock(MINUTE);
  const first = points[0];
  return (
    <div className={styles.layout}>
      <p className={styles.caption}>
        LOAKraken에서 이 캐릭터를 조회한 시점부터 기록돼요. 값이 바뀐
        시점만 점으로 남고, 마지막 값은 최근 확인 시각까지 이어서 그려요.
      </p>
      {query.isPending ? (
        // The same three chart panels and the table panel, holding the
        // charts' height, so the records arriving move nothing below
        // (user 10-11: text jumping on first load).
        <>
          <div className={styles.chartGrid}>
            {METRICS.map(({ key, label }, i) => (
              <Panel key={key} title={label}>
                <HistoryCells />
                <div className={styles.chartHold}>
                  {i === 0 && (
                    <p className={styles.muted} role="status">
                      <InlineOrb /> 기록을 불러오고 있어요.
                    </p>
                  )}
                </div>
              </Panel>
            ))}
          </div>
          <Panel
            title="기록 표"
            wide
            meta={
              <button type="button" className={styles.textButton} disabled>
                기록 보기
              </button>
            }
          >
            <p className={styles.muted} aria-hidden="true">
              &nbsp;
            </p>
          </Panel>
        </>
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
              const summary = historySummary(steps, now ?? steps.at(-1)?.t ?? 0);
              return (
                <Panel
                  key={key}
                  title={label}
                  meta={summary ? `${shortDate(summary.since)} ~ 오늘 · ${number(summary.days)}일` : undefined}
                >
                  <HistoryCells summary={summary} />
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

/** Source sections in players' words; a key this build does not know is left out (open strings). */
const sectionLabels: Record<string, string> = {
  equipment: "장비",
  engravings: "각인",
  gems: "보석",
  cards: "카드",
  arkPassive: "아크 패시브",
  arkGrid: "아크 그리드",
  siblings: "원정대",
  skills: "스킬",
  avatars: "아바타",
  collectibles: "내실",
};

export function EvidenceTab({
  data,
  envelope,
}: {
  data: Character;
  envelope: CharacterEnvelope;
}) {
  const findings = data.analysis.diagnostics.findings;
  // Only the sections with a name (P1: raw keys showed on screen).
  const sections = Object.entries(data.coverage)
    .filter(([key]) => Object.hasOwn(sectionLabels, key))
    .map(([key, value]) => ({ key, label: sectionLabels[key], value }));
  return (
    <div className={styles.layout}>
      {/* The rule version is for the record, not the reader (P1). */}
      <Panel title="세팅 점검 결과" wide>
        <p className={styles.muted}>
          점검 규칙을 늘려 가는 중인 베타 기능이에요. 정보 부족은 세팅 오류를
          뜻하지 않고, 확인 항목도 의도한 세팅일 수 있어요.
        </p>
        <p className={styles.muted}>세팅 해설 기능은 준비 중이에요.</p>
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
          {sections.map(({ key, label, value }) => {
            const state =
              typeof value === "string" || value === null ? value : value.state;
            return (
              <li key={key}>
                <strong>{label}</strong>
                <span data-state={state ?? undefined}>
                  {state ? coverageLabel(state) : "조회 안 함"}
                </span>
                {value && typeof value === "object" && (
                  <small>
                    {Object.entries(value.collections)
                      .filter(([name]) => Object.hasOwn(collectionLabels, name))
                      .map(
                        ([name, item]) =>
                          `${collectionLabels[name]} ${item ? coverageLabel(item) : "-"}`,
                      )
                      .join(" · ")}
                  </small>
                )}
              </li>
            );
          })}
        </ul>
        {/* What the two "not shown" states mean (P1). */}
        <p className={styles.muted}>
          데이터 미제공은 전투정보실이 그 정보를 주지 않은 것이고, 조회 안 함은 이번 조회에서 따로 불러오지 않은
          항목이에요.
        </p>
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
      <h2 id={TAB_HEADING} className={styles.srOnly} tabIndex={-1}>
        {TABS.find((item) => item.id === tab)?.label} 탭
      </h2>
      {tab === "simulator" ? (
        <SimulatorTab data={data} />
      ) : tab === "specup" ? (
        <SpecUpTab data={data} />
      ) : tab === "skills" ? (
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
      ) : tab === "guild" ? (
        <GuildTab data={data} />
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
