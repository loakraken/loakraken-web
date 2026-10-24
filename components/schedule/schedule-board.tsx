"use client";

// The weekly schedule board: the home card and the dedicated /schedule page
// share it (the page adds category routes and shows every official category).

import { useEffect, useId, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronRight } from "@/components/ui/icons";
import { safeGameImage } from "@/lib/character/model";
import { fetchSchedule, homeScheduleKey } from "@/lib/home/client";
import {
  dayLabel,
  kstDate,
  kstTime,
  rewardGroupLabel,
  rewardLabel,
  rewardSummary,
  sectionStatus,
  tomorrowInWeek,
  weekDays,
  type Island,
  type Reward,
  type RewardGroup,
  type Schedule,
} from "@/lib/home/model";
import {
  SCHEDULE_CATEGORIES,
  categoryLabel,
  categoryOfPath,
  dayKinds,
  mergeSameRounds,
  running,
  scheduleGroups,
  schedulePath,
  type Place,
  type Row,
  type ScheduleCategory,
} from "@/lib/home/schedule";
import { Countdown, useNow } from "@/components/home/clock";
import styles from "@/components/home/home.module.css";
import expand from "@/components/site/expand.module.css";
import own from "./schedule.module.css";
import { countdownText, retryLabel } from "@/lib/api/rate-limit";
import { pendingProps } from "@/lib/api/pending";
import { useRateLimit } from "@/lib/api/use-rate-limit";

/** One schedule day; null is "today" (the key the server prefetch fills). */
export const useSchedule = (date: string | null) =>
  useQuery({
    queryKey: homeScheduleKey(date),
    queryFn: ({ signal }) => fetchSchedule(date, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

/**
 * Chaos gate / field boss days for the week strip dots. The week data has no
 * per-day kinds, so each day's own answer is asked — the same query and cache
 * as picking that day, so a later pick shows at once. Unknown days stay null.
 */
function useWeekKinds(days: string[], today: string | null) {
  const results = useQueries({
    queries: days.map((day) => {
      const date = day === today ? null : day;
      return {
        queryKey: homeScheduleKey(date),
        queryFn: ({ signal }: { signal: AbortSignal }) => fetchSchedule(date, signal),
        staleTime: 5 * 60_000,
      };
    }),
  });
  return new Map(
    days.map((day, i) => {
      const data = results[i]?.data?.data;
      return [day, data && data.date === day ? dayKinds(data) : null] as const;
    }),
  );
}

/**
 * Category links on the schedule page: real URLs (shareable, server-rendered),
 * but a plain click only pushes the history entry, which Next syncs into
 * usePathname, so the picked day and toggles stay as they are.
 */
export function useCategoryNav() {
  const category = categoryOfPath(usePathname());
  const go = (slug: ScheduleCategory | null) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (slug !== category) window.history.pushState(null, "", schedulePath(slug));
  };
  return { category, go };
}

export function Rewards({ kinds }: { kinds: Island["rewardKinds"] }) {
  if (!kinds.length) return null;
  return (
    <span className={styles.rewards}>
      {kinds.map((kind) => (
        <i key={kind} data-kind={kind}>
          {rewardLabel(kind)}
        </i>
      ))}
    </span>
  );
}

/** Name in body ink; the grade shows as the dot or icon ring colour and as hidden text. */
function RewardItem({ reward }: { reward: Reward }) {
  const icon = safeGameImage(reward.icon);
  return (
    <li data-grade={reward.grade ?? undefined} title={reward.grade ? `${reward.name} · ${reward.grade}` : reward.name}>
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element -- official CDN icon at a fixed size
        <img src={icon} alt="" width={20} height={20} loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <i aria-hidden="true" />
      )}
      <span>{reward.name}</span>
      {reward.grade && <span className={styles.srOnly}>({reward.grade})</span>}
    </li>
  );
}

/** One reward list inside the expanded panel; titled only when both kinds show. */
function RewardList({ title, rewards }: { title: string | null; rewards: Reward[] }) {
  if (!rewards.length) return null;
  return (
    <div>
      {title && <h4>{title}</h4>}
      <ul className={styles.rewardItems}>
        {rewards.map((reward) => (
          <RewardItem key={reward.name} reward={reward} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Rewards on a schedule row: the top three inline, "+N" opens the
 * full list by item-level group (chaos gates differ by level), with rewards
 * tied to that day's rounds apart from the common ones.
 */
function RowRewards({ name, groups, entry }: { name: string; groups: RewardGroup[]; entry?: Entry }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { top, rest } = rewardSummary(groups);
  if (!top.length && !entry) return null;
  return (
    <>
      <ul className={styles.rewardItems} aria-label={`${name} 보상`}>
        {top.map((reward) => (
          <RewardItem key={reward.name} reward={reward} />
        ))}
        <li>
          <button
            type="button"
            className={styles.rewardMore}
            aria-expanded={open}
            aria-controls={id}
            aria-label={
              open ? `${name} 보상 접기` : rest > 0 ? `${name} 보상 ${rest}개 더 보기` : `${name} 보상 자세히 보기`
            }
            onClick={() => setOpen((value) => !value)}
          >
            {/* Both labels in one cell, one shown: the button is as wide open as
                closed, so '접기' (wider than '+3') never wraps it to the next
                line of the rewards — the pressed button stays put (A7). */}
            <span className={styles.rewardLabels}>
              <span data-on={!open || undefined}>{rest > 0 ? `+${rest}` : "자세히"}</span>
              <span data-on={open || undefined}>접기</span>
            </span>
          </button>
        </li>
      </ul>
      {open && (
        <div id={id} className={styles.rewardPanel}>
          {entry && <EntryInfo entry={entry} />}
          {groups.map((group, i) => {
            const label = rewardGroupLabel(group);
            const timed = group.rewards.filter((reward) => reward.timed);
            const common = group.rewards.filter((reward) => !reward.timed);
            return (
              <section key={`${group.minItemLevel}-${i}`} aria-label={label ?? "보상"}>
                {label && <h3>{label}</h3>}
                <RewardList title="이 날 회차 보상" rewards={timed} />
                <RewardList title={timed.length ? "공통 보상" : null} rewards={common} />
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Where and from which level a chaos gate or field boss row runs (its 자세히 panel). */
type Entry = { places: Place[] } | { minItemLevel: number | null };

const levelText = (level: number | null | undefined) =>
  level && level > 1 ? `${level.toLocaleString("ko-KR")} 이상` : "레벨 제한 없음";

function EntryInfo({ entry }: { entry: Entry }) {
  if (!("places" in entry))
    return (
      <section aria-label="입장">
        <h3>입장 {levelText(entry.minItemLevel)}</h3>
      </section>
    );
  return (
    <section aria-label="지역">
      <h3>지역 {entry.places.length}곳</h3>
      <ul className={own.places}>
        {entry.places.map((place) => (
          <li key={place.name}>
            <span>{place.name}</span>
            <small>{levelText(place.minItemLevel)}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Times({
  times,
  now,
  hidePast,
}: {
  times: string[];
  now: number | null;
  hidePast: boolean;
}) {
  if (!times.length)
    return <span className={styles.times}>오늘 회차 없음</span>;
  // Hidden past rounds keep their place: the rounds left never move when
  // the toggle flips or a round passes (A7), they are only not shown or read.
  // A row whose rounds are all over says so over its hidden times, so it
  // does not read as a future one and keeps its height (PM-프론트 10-13).
  const over = hidePast && now !== null && times.every((at) => Date.parse(at) < now);
  return (
    <span className={styles.times}>
      {over && <span className={styles.ended}>오늘 종료</span>}
      {times.map((at) => {
        const past = now !== null && Date.parse(at) < now;
        return (
          <time
            key={at}
            dateTime={at}
            data-past={past || undefined}
            data-hidden={(hidePast && past) || undefined}
            aria-hidden={(hidePast && past) || undefined}
          >
            {kstTime(at)}
          </time>
        );
      })}
    </span>
  );
}

function Section({
  title,
  items,
  live,
  clock,
  hidePast,
  onShowTomorrow,
  levelInDetail = false,
}: {
  title: string;
  items: Row[];
  /** Chaos gates and field bosses: no level line on the row, it is in 자세히. */
  levelInDetail?: boolean;
  live: boolean;
  /** The board clock (server render time until the client clock starts), so
   *  past rounds are already hidden in the first HTML (CLS, QA #181). */
  clock: number | null;
  hidePast: boolean;
  onShowTomorrow?: () => void;
}) {
  const now = live ? clock : null;
  if (!items.length) return null;
  const status = now !== null ? sectionStatus(items, now) : null;
  // Every row stays, the toggle or the clock never adds or drops one (A7);
  // a row whose rounds are all over reads "오늘 종료" (Times).
  const left =
    now !== null
      ? items.filter(
          (item) =>
            !item.startTimes.length ||
            item.startTimes.some((at) => Date.parse(at) >= now),
        ).length
      : items.length;
  return (
    <section className={styles.section} aria-label={title}>
      <header>
        <h3>{title}</h3>
        {/* Drawn anew when it changes: a different count rewritten in place
            moves what follows it in the head (A7). */}
        <span key={left}>
          {left > 0 && left < items.length
            ? `${items.length}개 중 ${left}개 남음`
            : `${items.length}개`}
        </span>
        {status && now !== null && (status.next || status.state === "done") && (
          <span className={styles.next} data-state={status.state}>
            {status.state === "done" && "오늘 일정 종료"}
            {status.state === "done" && status.next && " · "}
            {status.next && (
              <>
                {status.state !== "upcoming" && `${dayLabel(status.next, now)} `}
                {kstTime(status.next)} · <Countdown to={status.next} fallback={now} />
                {status.state !== "upcoming" && " 후"}
              </>
            )}
          </span>
        )}
        {status?.state === "done" && onShowTomorrow && (
          // A text button 17px high: its press area is 44 on phones and touch (A36, QA 10-14 23시).
          <button type="button" className={`${styles.textButton} hit-44`} onClick={onShowTomorrow}>
            내일 일정 보기
          </button>
        )}
      </header>
      <ul className={styles.rows}>
        {items.map((item) => (
          <li key={`${"category" in item ? item.category : ""}${item.name}`}>
            <RowIcon src={item.icon} />
            <span className={styles.rowName}>
              <strong>{item.name}</strong>
              {levelInDetail ? (
                item.places && <small>{item.places.length}곳</small>
              ) : (
                <small>
                  {"category" in item && `${item.category} · `}
                  {levelText(item.minItemLevel)}
                </small>
              )}
            </span>
            {"rewardKinds" in item && <Rewards kinds={item.rewardKinds} />}
            <Times times={item.startTimes} now={now} hidePast={hidePast} />
            <RowRewards
              name={item.name}
              groups={item.rewardGroups}
              entry={levelInDetail ? (item.places ? { places: item.places } : { minItemLevel: item.minItemLevel }) : undefined}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * "오늘: 카오스게이트 · 필드 보스 없음" (or "이 날:" for another day): both
 * kinds always, the one not running said plainly. Each name carries its week
 * strip dot colour, so the line is also the dots' legend.
 */
function DayKinds({ kinds, today }: { kinds: ReturnType<typeof dayKinds>; today: boolean }) {
  return (
    <>
      {/* Each piece is its own 20px box (flex items): the line keeps its
          height whatever fonts draw bold and regular glyphs. */}
      <span>{today ? "오늘" : "이 날"}: </span>
      {kinds.map((kind, i) => (
        <span key={kind.key} data-kind={kind.key} data-on={kind.on || undefined}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          <i aria-hidden="true" />
          {kind.on ? <b>{kind.label}</b> : `${kind.label} 없음`}
        </span>
      ))}
    </>
  );
}

/** The chaos gate and field boss dots on a week strip day; empty slots until that day is known. */
function KindDots({ kinds }: { kinds: ReturnType<typeof dayKinds> | null }) {
  return (
    <span className={own.kindDots} aria-hidden="true">
      {kinds?.map((kind) => kind.on && <i key={kind.key} data-kind={kind.key} />)}
    </span>
  );
}

/** "10월 10일 토요일" for a schedule date. */
function dateTitle(date: string) {
  const [, m, d] = date.split("-").map(Number);
  const weekday = weekDays(date, date)[0]?.weekday;
  return `${m}월 ${d}일${weekday ? ` ${weekday}요일` : ""}`;
}

/** A row icon, official CDN only (safeGameImage); anything else shows none. */
function RowIcon({ src }: { src: string | null | undefined }) {
  const safe = safeGameImage(src);
  // eslint-disable-next-line @next/next/no-img-element -- official CDN icon at a fixed size
  return safe ? <img src={safe} alt="" width={36} height={36} loading="lazy" referrerPolicy="no-referrer" /> : null;
}

/**
 * Past rounds are hidden from the server render time until the client clock
 * starts, so the first HTML already has the final row heights (CLS, QA #181).
 * On the page every official category gets its own section and the category
 * links filter them; the home card keeps the three main lists.
 */
export function ScheduleBoard({
  renderedAt,
  variant = "home",
}: {
  renderedAt?: number;
  variant?: "home" | "page";
}) {
  const page = variant === "page";
  const now = useNow(renderedAt);
  const today = now === null ? null : kstDate(now);
  const [picked, setPicked] = useState<string | null>(null);
  const [hidePast, setHidePast] = useState(true);
  const { category, go } = useCategoryNav();
  const shownCategory = page ? category : null;
  const date = picked === today ? null : picked;
  // "today" is a fixed key so the server-prefetched schedule hydrates.
  const query = useSchedule(date);
  const limit = useRateLimit(query.error);
  const data: Schedule | undefined = query.data?.data;
  const stale = date === null && !!data && !!today && data.date !== today;
  const { refetch } = query;
  useEffect(() => {
    if (stale) refetch();
  }, [stale, refetch]);
  const gold = new Set(data?.goldIslandDays.map((day) => day.date));
  const live = !!data && data.date === today;
  const tomorrow = live && now !== null ? tomorrowInWeek(data.coveredTo, now) : null;
  const showTomorrow = tomorrow ? () => setPicked(tomorrow) : undefined;
  const week = data ? weekDays(data.coveredFrom, data.coveredTo) : [];
  const weekKinds = useWeekKinds(page ? week.map((day) => day.date) : [], today);
  const groups = page && data ? scheduleGroups(data) : [];
  const shownGroups = shownCategory
    ? groups.filter((group) => group.slug === shownCategory)
    : groups.filter((group) => group.items.length > 0);

  return (
    <section
      id={page ? undefined : "schedule"}
      className={styles.panel}
      aria-labelledby="schedule-heading"
    >
      <div className={page ? `${styles.panelHead} ${own.pageHead}` : styles.panelHead}>
        <h2 id="schedule-heading">
          {page ? (data ? dateTitle(data.date) : "일정") : "주간 일정표"}
          {page && live && <span className={own.todayMark}>오늘</span>}
        </h2>
        <span className={styles.headTools}>
          <span className={styles.legend}>
            <i data-kind="GOLD" /> 골드 섬
          </span>
          <button
            type="button"
            className={styles.toggle}
            aria-pressed={hidePast}
            onClick={() => setHidePast(!hidePast)}
          >
            지난 회차 숨김
          </button>
        </span>
      </div>
      {page && (
        // One line, there from the first HTML, so the answer or another day
        // never moves the day buttons below it (A7).
        <p className={own.dayKinds}>
          {/* Drawn anew per day: words rewritten in place slide the rest of
              the line sideways, which counts as moving (A7); new nodes do not. */}
          {data && <DayKinds key={`${data.date}-${live}`} kinds={dayKinds(data)} today={live} />}
        </p>
      )}
      {data && (
        <div className={styles.days} role="group" aria-label="요일 선택">
          {week.map((day) => {
            const kinds = weekKinds.get(day.date) ?? null;
            const running = kinds?.filter((kind) => kind.on).map((kind) => `, ${kind.label}`).join("") ?? "";
            return (
              <button
                key={day.date}
                type="button"
                aria-pressed={day.date === data.date}
                aria-label={`${day.day}일 ${day.weekday}요일${gold.has(day.date) ? ", 골드 섬" : ""}${running}${day.date === today ? ", 오늘" : ""}`}
                title={running ? running.slice(2).replaceAll(", ", "·") : undefined}
                data-today={day.date === today || undefined}
                data-gold={gold.has(day.date) || undefined}
                data-weekend={
                  day.weekday === "토" || day.weekday === "일" || undefined
                }
                onClick={() => setPicked(day.date)}
              >
                <b>{day.day}</b>
                <span>{day.weekday}</span>
                {page && <KindDots kinds={kinds} />}
              </button>
            );
          })}
        </div>
      )}
      {page && (
        <nav className={own.chips} aria-label="일정 분류">
          <a
            href={schedulePath(null)}
            aria-current={shownCategory === null ? "page" : undefined}
            onClick={go(null)}
          >
            전체
          </a>
          {SCHEDULE_CATEGORIES.map((item) => (
            <a
              key={item.slug}
              href={schedulePath(item.slug)}
              aria-current={shownCategory === item.slug ? "page" : undefined}
              onClick={go(item.slug)}
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
      {query.isPending ? (
        <p className={styles.muted}>일정을 불러오고 있어요…</p>
      ) : !data ? (
        <div className={styles.muted}>
          <p>{limit.limited ? countdownText(limit.seconds) : "일정을 불러오지 못했어요."}</p>
          <button
            type="button"
            className={`${styles.textButton} hit-44`}
            onClick={() => query.refetch()}
            disabled={limit.seconds > 0}
          >
            {retryLabel(limit.seconds)}
          </button>
        </div>
      ) : page ? (
        <div
          // Drawn anew for another day: rows rewritten in place count as
          // moving when their text starts elsewhere, new rows do not (A7).
          key={data.date}
          className={styles.sections}
          {...pendingProps(query)}
        >
          {shownGroups.map((group) => (
            <Section
              key={group.key}
              title={group.label}
              hidePast={hidePast}
              onShowTomorrow={showTomorrow}
              levelInDetail={group.key === "chaos-gate" || group.key === "field-boss"}
              items={group.items}
              live={live}
              clock={now}
            />
          ))}
          {!shownGroups.some((group) => group.items.length > 0) && (
            <p className={styles.muted}>
              {shownCategory
                ? `이 날은 ${categoryLabel(shownCategory)} 일정이 없어요.`
                : "이 날은 일정이 없어요."}
            </p>
          )}
        </div>
      ) : (
        <div
          // Drawn anew for another day: rows rewritten in place count as
          // moving when their text starts elsewhere, new rows do not (A7).
          key={data.date}
          className={styles.sections}
          {...pendingProps(query)}
        >
          <Section
            title="모험 섬"
            hidePast={hidePast}
            onShowTomorrow={showTomorrow}
            items={data.adventureIslands}
            live={live}
            clock={now}
          />
          <Section
            title="카오스게이트"
            hidePast={hidePast}
            onShowTomorrow={showTomorrow}
            levelInDetail
            items={mergeSameRounds(running(data.chaosGates), "카오스게이트")}
            live={live}
            clock={now}
          />
          <Section
            title="필드 보스"
            hidePast={hidePast}
            onShowTomorrow={showTomorrow}
            levelInDetail
            items={mergeSameRounds(running(data.fieldBosses), "필드 보스")}
            live={live}
            clock={now}
          />
          {data.others.length > 0 && (
            <details className={`${styles.others} ${expand.expand}`}>
              <summary>
                기타 일정 <span>{data.others.length}개</span>
                <ChevronRight size={14} aria-hidden="true" />
              </summary>
              <Section
                title="기타 일정"
                hidePast={hidePast}
                items={data.others}
                live={live}
                clock={now}
              />
            </details>
          )}
          {!data.adventureIslands.length &&
            !running(data.chaosGates).length &&
            !running(data.fieldBosses).length && (
              <p className={styles.muted}>
                이 날은 모험 섬·카오스게이트·필드 보스 일정이 없어요.
              </p>
            )}
        </div>
      )}
      {!page && (
        <Link href="/schedule" className={own.all}>
          주간 일정 전체 보기 <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
