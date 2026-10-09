"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronRight,
  Search,
  TriangleAlert,
} from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import {
  characterNameError,
  normalizeCharacterName,
} from "@/lib/character/model";
import { fetchNews, fetchSchedule, homeNewsKey, homeScheduleKey } from "@/lib/home/client";
import {
  NOTICE_LABEL,
  REWARD_LABEL,
  countdown,
  dDay,
  kstDate,
  kstTime,
  tomorrowInWeek,
  upcomingMaintenance,
  sectionStatus,
  dayLabel,
  periodText,
  weekDays,
  type Island,
  type Other,
  type Schedule,
  type Timed,
} from "@/lib/home/model";
import { fetchMarketBoard } from "@/lib/market/client";
import { changeLabel, goldText } from "@/lib/market/board";
import { RecentCard } from "./recent-card";
import styles from "./home.module.css";

/*
 * Clocks, null during SSR so time-dependent text renders after hydration.
 * Only countdown leaves tick every second; everything else ticks per minute,
 * so the dashboard does not re-render once a second.
 */
const subscribers = new Map<number, (callback: () => void) => () => void>();
const subscribeEvery = (step: number) => {
  let subscribe = subscribers.get(step);
  if (!subscribe) {
    subscribe = (callback) => {
      const id = setInterval(callback, step);
      return () => clearInterval(id);
    };
    subscribers.set(step, subscribe);
  }
  return subscribe;
};
const useClock = (step: number) =>
  useSyncExternalStore(
    subscribeEvery(step),
    () => Math.floor(Date.now() / step) * step,
    () => null,
  );
const SECOND = 1000;
const MINUTE = 60_000;

function Countdown({ to }: { to: string }) {
  const now = useClock(SECOND);
  if (now === null) return null;
  return <b>{countdown(to, now) ?? "곧 시작"}</b>;
}

function SearchHero() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = normalizeCharacterName(query);
    const issue = characterNameError(name);
    if (issue) {
      setError(issue);
      input.current?.focus();
      return;
    }
    router.push(`/character/${encodeURIComponent(name)}`);
  }

  return (
    <section className={styles.hero} aria-labelledby="home-search">
      <h1 id="home-search" className={styles.srOnly}>
        로스트아크 캐릭터 검색
      </h1>
      <form className={styles.search} onSubmit={submit} role="search">
        <Search size={20} aria-hidden="true" />
        <input
          ref={input}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setError("");
          }}
          placeholder="캐릭터 이름을 입력하세요"
          aria-label="캐릭터 이름"
          aria-invalid={!!error}
          aria-describedby={error ? "home-search-error" : undefined}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        <kbd className={styles.kbd} aria-hidden="true">
          Ctrl K
        </kbd>
        <button type="submit" aria-label="검색">
          <ArrowRight size={18} />
        </button>
      </form>
      {error && (
        <p id="home-search-error" className={styles.searchError} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function Rewards({ kinds }: { kinds: Island["rewardKinds"] }) {
  if (!kinds.length) return null;
  return (
    <span className={styles.rewards}>
      {kinds.map((kind) => (
        <i key={kind} data-kind={kind}>
          {REWARD_LABEL[kind]}
        </i>
      ))}
    </span>
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
  const shown =
    hidePast && now !== null ? times.filter((at) => Date.parse(at) >= now) : times;
  return (
    <span className={styles.times}>
      {shown.map((at) => (
        <time
          key={at}
          dateTime={at}
          data-past={(now !== null && Date.parse(at) < now) || undefined}
        >
          {kstTime(at)}
        </time>
      ))}
    </span>
  );
}

function Section({
  title,
  items,
  live,
  hidePast,
  onShowTomorrow,
}: {
  title: string;
  items: (Island | Timed | Other)[];
  live: boolean;
  hidePast: boolean;
  onShowTomorrow?: () => void;
}) {
  const clock = useClock(MINUTE);
  const now = live ? clock : null;
  if (!items.length) return null;
  const status = now !== null ? sectionStatus(items, now) : null;
  // Rounds today all over: hide the row (it would read as a future island).
  const visible =
    hidePast && now !== null
      ? items.filter(
          (item) =>
            !item.startTimes.length ||
            item.startTimes.some((at) => Date.parse(at) >= now),
        )
      : items;
  return (
    <section className={styles.section} aria-label={title}>
      <header>
        <h3>{title}</h3>
        <span>
          {visible.length > 0 && visible.length < items.length
            ? `${items.length}개 중 ${visible.length}개 남음`
            : `${items.length}개`}
        </span>
        {status && now !== null && (status.next || status.state === "done") && (
          <span className={styles.next} data-state={status.state}>
            {status.state === "done" && "오늘 일정 종료"}
            {status.state === "done" && status.next && " · "}
            {status.next && (
              <>
                {status.state !== "upcoming" && `${dayLabel(status.next, now)} `}
                {kstTime(status.next)} · <Countdown to={status.next} />
                {status.state !== "upcoming" && " 후"}
              </>
            )}
          </span>
        )}
        {status?.state === "done" && onShowTomorrow && (
          <button type="button" className={styles.textButton} onClick={onShowTomorrow}>
            내일 일정 보기
          </button>
        )}
      </header>
      <ul className={styles.rows}>
        {visible.map((item) => (
          <li key={`${"category" in item ? item.category : ""}${item.name}`}>
            {item.icon ? (
              // eslint-disable-next-line @next/next/no-img-element -- official CDN icon at a fixed size
              <img
                src={item.icon}
                alt=""
                width={36}
                height={36}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <span className={styles.rowName}>
              <strong>{item.name}</strong>
              <small>
                {"category" in item && `${item.category} · `}
                {item.minItemLevel && item.minItemLevel > 1
                  ? `${item.minItemLevel.toLocaleString("ko-KR")} 이상`
                  : "레벨 제한 없음"}
              </small>
            </span>
            {"rewardKinds" in item && <Rewards kinds={item.rewardKinds} />}
            <Times times={item.startTimes} now={now} hidePast={hidePast} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScheduleBoard() {
  const now = useClock(MINUTE);
  const today = now === null ? null : kstDate(now);
  const [picked, setPicked] = useState<string | null>(null);
  const [hidePast, setHidePast] = useState(true);
  const date = picked === today ? null : picked;
  const query = useQuery({
    // "today" is a fixed key so the server-prefetched schedule hydrates.
    queryKey: homeScheduleKey(date),
    queryFn: ({ signal }) => fetchSchedule(date, signal),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
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

  return (
    <section
      id="schedule"
      className={styles.panel}
      aria-labelledby="schedule-heading"
    >
      <div className={styles.panelHead}>
        <h2 id="schedule-heading">주간 일정표</h2>
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
      {data && (
        <div className={styles.days} role="group" aria-label="요일 선택">
          {weekDays(data.coveredFrom, data.coveredTo).map((day) => (
            <button
              key={day.date}
              type="button"
              aria-pressed={day.date === data.date}
              aria-label={`${day.day}일 ${day.weekday}요일${gold.has(day.date) ? ", 골드 섬" : ""}${day.date === today ? ", 오늘" : ""}`}
              data-today={day.date === today || undefined}
              data-gold={gold.has(day.date) || undefined}
              data-weekend={
                day.weekday === "토" || day.weekday === "일" || undefined
              }
              onClick={() => setPicked(day.date)}
            >
              <b>{day.day}</b>
              <span>{day.weekday}</span>
            </button>
          ))}
        </div>
      )}
      {query.isPending ? (
        <p className={styles.muted}>일정을 불러오고 있어요…</p>
      ) : !data ? (
        <div className={styles.muted}>
          <p>일정을 불러오지 못했어요.</p>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => query.refetch()}
          >
            다시 시도
          </button>
        </div>
      ) : (
        <div
          className={styles.sections}
          data-stale={query.isPlaceholderData || undefined}
        >
          <Section
            title="모험 섬"
            hidePast={hidePast}
            onShowTomorrow={showTomorrow}
            items={data.adventureIslands}
            live={live}
          />
          <Section
            title="카오스게이트"
            hidePast={hidePast}
            onShowTomorrow={showTomorrow}
            items={data.chaosGates}
            live={live}
          />
          <Section
            title="필드 보스"
            hidePast={hidePast}
            onShowTomorrow={showTomorrow}
            items={data.fieldBosses}
            live={live}
          />
          {data.others.length > 0 && (
            <details className={styles.others}>
              <summary>
                기타 일정 <span>{data.others.length}개</span>
                <ChevronRight size={14} aria-hidden="true" />
              </summary>
              <Section
                title="기타 일정"
                hidePast={hidePast}
                items={data.others}
                live={live}
              />
            </details>
          )}
          {!data.adventureIslands.length &&
            !data.chaosGates.length &&
            !data.fieldBosses.length && (
              <p className={styles.muted}>
                이 날은 모험 섬·카오스게이트·필드 보스 일정이 없어요.
              </p>
            )}
        </div>
      )}
    </section>
  );
}

const useNews = () =>
  useQuery({
    queryKey: homeNewsKey,
    queryFn: ({ signal }) => fetchNews(signal),
    staleTime: 5 * 60_000,
  });

/** Shown only on the maintenance day itself, above everything else. */
function MaintenanceBanner() {
  const now = useClock(MINUTE);
  const data = useNews().data?.data;
  const upcoming =
    data && now !== null ? upcomingMaintenance(data.notices, now) : null;
  if (!upcoming) return null;
  const maintenance = upcoming.notice;
  return (
    <a
      className={styles.maintenance}
      href={maintenance.url ?? undefined}
      target="_blank"
      rel="noreferrer"
    >
      <TriangleAlert size={16} aria-hidden="true" />
      <span>
        <b>{upcoming.when === "today" ? "오늘 점검" : "내일 점검"}</b> {maintenance.title}
      </span>
      <ChevronRight size={14} aria-hidden="true" />
    </a>
  );
}

function NewsPanels() {
  const now = useClock(MINUTE);
  const query = useNews();
  const data = query.data?.data;
  return (
    <>
      <section
        id="news"
        className={styles.panel}
        aria-labelledby="notice-heading"
      >
        <div className={styles.panelHead}>
          <h2 id="notice-heading">공지사항</h2>
          <a
            href="https://lostark.game.onstove.com/News/Notice/List"
            target="_blank"
            rel="noreferrer"
            className={styles.more}
          >
            더보기 <ChevronRight size={14} aria-hidden="true" />
          </a>
        </div>
        {!data ? (
          <p className={styles.muted}>
            {query.isPending
              ? "공지를 불러오고 있어요…"
              : "공지를 불러오지 못했어요."}
          </p>
        ) : (
          <ul className={styles.notices}>
            {data.notices.slice(0, 6).map((notice) => (
              <li key={`${notice.publishedAt}${notice.title}`}>
                <a
                  href={notice.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  <i data-category={notice.category ?? undefined}>
                    {notice.category ? NOTICE_LABEL[notice.category] : "공지"}
                  </i>
                  <span>{notice.title}</span>
                  <time dateTime={notice.publishedAt}>
                    {Number(
                      kstDate(Date.parse(notice.publishedAt)).slice(5, 7),
                    )}
                    .
                    {Number(
                      kstDate(Date.parse(notice.publishedAt)).slice(8, 10),
                    )}
                  </time>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={styles.panel} aria-labelledby="event-heading">
        <div className={styles.panelHead}>
          <h2 id="event-heading">진행 중인 이벤트</h2>
          {data && <span className={styles.count}>{data.events.length}개</span>}
        </div>
        {!data ? (
          <p className={styles.muted}>
            {query.isPending
              ? "이벤트를 불러오고 있어요…"
              : "이벤트를 불러오지 못했어요."}
          </p>
        ) : data.events.length === 0 ? (
          <p className={styles.muted}>진행 중인 이벤트가 없어요.</p>
        ) : (
          <ul className={styles.events}>
            {data.events.map((event) => {
              const left = now !== null ? dDay(event.endAt, now) : null;
              return (
                <li key={`${event.startAt}${event.title}`}>
                  <a
                    href={event.url ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {event.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element -- official event banner
                      <img
                        src={event.thumbnail}
                        alt=""
                        width={64}
                        height={36}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <span className={styles.eventText}>
                      <strong>{event.title}</strong>
                      <small>{periodText(event.startAt, event.endAt)}</small>
                    </span>
                    {left && (
                      <b
                        data-soon={
                          left === "D-day" ||
                          /^D-[1-3]$/.test(left) ||
                          undefined
                        }
                      >
                        {left}
                      </b>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function MarketSummary() {
  const query = useQuery({
    queryKey: ["home-market"],
    queryFn: ({ signal }) =>
      fetchMarketBoard(
        { tab: "REFINING", tier: 4, sort: "default", page: 1 },
        signal,
      ),
    staleTime: 5 * 60_000,
  });
  const items = query.data?.data.items.slice(0, 6) ?? [];
  return (
    <section className={styles.panel} aria-labelledby="market-heading">
      <div className={styles.panelHead}>
        <h2 id="market-heading">재련 재료 시세</h2>
        <Link href="/market" className={styles.more}>
          시세 더보기 <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </div>
      {!items.length ? (
        <p className={styles.muted}>
          {query.isPending
            ? "시세를 불러오고 있어요…"
            : "시세를 불러오지 못했어요."}
        </p>
      ) : (
        <ul className={styles.market}>
          {items.map((item) => {
            const change = changeLabel(item.changeDay);
            return (
              <li key={item.itemId}>
                <Link href="/market?tab=REFINING&tier=4">
                  {item.icon && (
                    // eslint-disable-next-line @next/next/no-img-element -- official CDN icon at a fixed size
                    <img
                      src={item.icon}
                      alt=""
                      width={28}
                      height={28}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <span data-grade={item.grade ?? undefined}>{item.name}</span>
                  <b>{goldText(item.currentMinPrice)}</b>
                  <small data-direction={change.direction}>{change.text}</small>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function HomeDashboard() {
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#home-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="home-main" className={styles.main}>
        <SearchHero />
        <MaintenanceBanner />
        <div className={styles.grid}>
          <div className={styles.column}>
            <ScheduleBoard />
            <MarketSummary />
          </div>
          <aside className={styles.column} aria-label="공지와 이벤트">
            <RecentCard />
            <NewsPanels />
          </aside>
        </div>
      </main>
      <footer className={styles.footer}>
        <p>로스트아크 비공식 팬 프로젝트 · 공식 OPEN API 데이터 사용</p>
        <Link href="/about">LOAKraken 소개</Link>
      </footer>
    </div>
  );
}
