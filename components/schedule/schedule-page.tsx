"use client";

// /schedule: weekly reset, upcoming rounds, categories, hide past, this
// week's gold islands, and per-category views.

import { SiteHeader } from "@/components/site/site-header";
import { Countdown, MINUTE, useClock, useRemaining } from "@/components/home/clock";
import home from "@/components/home/home.module.css";
import { kstDate, kstTime, weekDays } from "@/lib/home/model";
import { scheduleGroups, schedulePath, upcomingRounds } from "@/lib/home/schedule";
import { nextReset } from "@/lib/tools/homework";
import { Rewards, ScheduleBoard, useCategoryNav, useSchedule } from "./schedule-board";
import styles from "./schedule.module.css";

/** Today's next round per category; only while today's schedule is loaded. */
function Upcoming({ renderedAt }: { renderedAt?: number }) {
  const now = useClock(MINUTE) ?? renderedAt ?? null;
  const data = useSchedule(null).data?.data;
  const { go } = useCategoryNav();
  if (!data || now === null || data.date !== kstDate(now)) return null;
  const rounds = upcomingRounds(scheduleGroups(data), now);
  if (!rounds.length) return null;
  return (
    <section className={styles.upcoming} aria-labelledby="upcoming-heading">
      <h2 id="upcoming-heading">다가오는 일정</h2>
      <ul>
        {rounds.map((round) => {
          const body = (
            <>
              <span className={styles.roundLabel}>{round.label}</span>
              <span className={styles.roundTime}>
                <time dateTime={round.at}>{kstTime(round.at)}</time>
                <Countdown to={round.at} fallback={now} />
              </span>
              <span className={styles.roundNames} title={round.names.join(", ")}>
                {round.names.join(" · ")}
              </span>
            </>
          );
          return (
            <li key={round.key}>
              {round.slug ? (
                <a href={schedulePath(round.slug)} onClick={go(round.slug)}>
                  {body}
                </a>
              ) : (
                <div>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The week's adventure islands by day, gold days marked ("이번 주 골드 섬"). */
function WeekIslands({ renderedAt }: { renderedAt?: number }) {
  const now = useClock(MINUTE) ?? renderedAt ?? null;
  const data = useSchedule(null).data?.data;
  if (!data?.weekly.length) return null;
  const today = now === null ? null : kstDate(now);
  const gold = new Map(data.goldIslandDays.map((day) => [day.date, day.islands]));
  const labels = new Map(
    weekDays(data.coveredFrom, data.coveredTo).map((day) => [day.date, day]),
  );
  return (
    <section className={home.panel} aria-labelledby="week-islands-heading">
      <div className={home.panelHead}>
        <h2 id="week-islands-heading">이번 주 모험 섬</h2>
        <span className={home.count}>골드 섬 {gold.size}일</span>
      </div>
      <ol className={styles.week}>
        {data.weekly.map((day) => {
          const label = labels.get(day.date);
          const golden = gold.get(day.date) ?? [];
          return (
            <li
              key={day.date}
              data-gold={golden.length > 0 || undefined}
              data-today={day.date === today || undefined}
            >
              <span className={styles.weekDay}>
                <b>{label?.day ?? Number(day.date.slice(8))}</b>
                <span data-weekend={label?.weekday === "토" || label?.weekday === "일" || undefined}>
                  {label?.weekday}
                </span>
              </span>
              {day.islands.length ? (
                <ul className={styles.weekIslands}>
                  {day.islands.map((island) => (
                    <li key={island.name} data-gold={golden.includes(island.name) || undefined}>
                      <span>{island.name}</span>
                      <Rewards kinds={island.rewardKinds} />
                    </li>
                  ))}
                </ul>
              ) : (
                <span className={styles.weekNone}>모험 섬 없음</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ResetLine({ renderedAt }: { renderedAt?: number }) {
  const now = useClock(MINUTE) ?? renderedAt ?? null;
  // Seconds tick only in the last hour (shared remaining-time rule).
  const left = useRemaining(now === null ? Number.NaN : nextReset(now), now);
  return (
    <p className={styles.reset}>
      매주 수요일 06:00 초기화
      {left && <> · 다음 초기화까지 <b>{left}</b></>}
    </p>
  );
}

export function SchedulePage({ renderedAt }: { renderedAt?: number }) {
  return (
    <div className={home.page}>
      <a className={home.skip} href="#schedule-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="schedule-main" className={home.main}>
        <header className={styles.head}>
          <h1>주간 일정</h1>
          <ResetLine renderedAt={renderedAt} />
        </header>
        <Upcoming renderedAt={renderedAt} />
        <div className={home.grid}>
          <ScheduleBoard renderedAt={renderedAt} variant="page" />
          <aside className={home.column} aria-label="이번 주 모험 섬">
            <WeekIslands renderedAt={renderedAt} />
          </aside>
        </div>
      </main>
    </div>
  );
}
