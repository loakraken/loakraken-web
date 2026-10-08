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
  Star,
  TriangleAlert,
} from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import {
  characterNameError,
  normalizeCharacterName,
} from "@/lib/character/model";
import { fetchNews, fetchSchedule } from "@/lib/home/client";
import {
  NOTICE_LABEL,
  REWARD_LABEL,
  countdown,
  dDay,
  kstDate,
  kstTime,
  maintenanceToday,
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
import styles from "./home.module.css";

/* Clock: one tick per second, null during SSR so times render after hydration. */
const subscribeClock = (callback: () => void) => {
  const id = setInterval(callback, 1000);
  return () => clearInterval(id);
};
const useNow = () =>
  useSyncExternalStore(
    subscribeClock,
    () => Math.floor(Date.now() / 1000) * 1000,
    () => null,
  );

/* Favourites written by the character page (per browser). */
const FAVORITES = "loakraken:favorites";
const readFavorites = () => {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES) ?? "[]");
    return Array.isArray(value)
      ? value
          .filter((v) => typeof v === "string")
          .slice(0, 8)
          .join("\n")
      : "";
  } catch {
    return "";
  }
};
const subscribeStorage = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("loakraken:favorites", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("loakraken:favorites", callback);
  };
};

function SearchHero() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const favorites = useSyncExternalStore(
    subscribeStorage,
    readFavorites,
    () => "",
  )
    .split("\n")
    .filter(Boolean);

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
      {favorites.length > 0 && (
        <ul className={styles.favorites} aria-label="즐겨찾기">
          {favorites.map((name) => (
            <li key={name}>
              <Link href={`/character/${encodeURIComponent(name)}`}>
                <Star size={12} aria-hidden="true" />
                {name}
              </Link>
            </li>
          ))}
        </ul>
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

function Times({ times, now }: { times: string[]; now: number | null }) {
  if (!times.length)
    return <span className={styles.times}>오늘 회차 없음</span>;
  return (
    <span className={styles.times}>
      {times.map((at) => (
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
  now,
  live,
}: {
  title: string;
  items: (Island | Timed | Other)[];
  now: number | null;
  live: boolean;
}) {
  if (!items.length) return null;
  const status = live && now !== null ? sectionStatus(items, now) : null;
  return (
    <section className={styles.section} aria-label={title}>
      <header>
        <h3>{title}</h3>
        <span>{items.length}개</span>
        {status && now !== null && (status.next || status.state === "done") && (
          <span className={styles.next} data-state={status.state}>
            {status.state === "done" && "오늘 일정 종료"}
            {status.state === "done" && status.next && " · "}
            {status.next && (
              <>
                {status.state !== "upcoming" && `${dayLabel(status.next, now)} `}
                {kstTime(status.next)} · <b>{countdown(status.next, now)}</b>
                {status.state !== "upcoming" && " 후"}
              </>
            )}
          </span>
        )}
      </header>
      <ul className={styles.rows}>
        {items.map((item) => (
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
            <Times times={item.startTimes} now={live ? now : null} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScheduleBoard({ now }: { now: number | null }) {
  const today = now === null ? null : kstDate(now);
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;
  const query = useQuery({
    queryKey: ["home-schedule", date],
    queryFn: ({ signal }) =>
      fetchSchedule(date === today ? null : date, signal),
    enabled: date !== null,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
  const data: Schedule | undefined = query.data?.data;
  const gold = new Set(data?.goldIslandDays.map((day) => day.date));
  const live = data?.date === today;

  return (
    <section
      id="schedule"
      className={styles.panel}
      aria-labelledby="schedule-heading"
    >
      <div className={styles.panelHead}>
        <h2 id="schedule-heading">주간 일정표</h2>
        <span className={styles.legend}>
          <i data-kind="GOLD" /> 골드 섬
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
            items={data.adventureIslands}
            now={now}
            live={live}
          />
          <Section
            title="카오스게이트"
            items={data.chaosGates}
            now={now}
            live={live}
          />
          <Section
            title="필드 보스"
            items={data.fieldBosses}
            now={now}
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
                items={data.others}
                now={now}
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
    queryKey: ["home-news"],
    queryFn: ({ signal }) => fetchNews(signal),
    staleTime: 5 * 60_000,
  });

/** Shown only on the maintenance day itself, above everything else. */
function MaintenanceBanner({ now }: { now: number | null }) {
  const data = useNews().data?.data;
  const maintenance =
    data && now !== null ? maintenanceToday(data.notices, now) : null;
  if (!maintenance) return null;
  return (
    <a
      className={styles.maintenance}
      href={maintenance.url ?? undefined}
      target="_blank"
      rel="noreferrer"
    >
      <TriangleAlert size={16} aria-hidden="true" />
      <span>
        <b>오늘 점검</b> {maintenance.title}
      </span>
      <ChevronRight size={14} aria-hidden="true" />
    </a>
  );
}

function NewsPanels({ now }: { now: number | null }) {
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
  const now = useNow();
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#home-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="home-main" className={styles.main}>
        <SearchHero />
        <MaintenanceBanner now={now} />
        <div className={styles.grid}>
          <div className={styles.column}>
            <ScheduleBoard now={now} />
            <MarketSummary />
          </div>
          <aside className={styles.column} aria-label="공지와 이벤트">
            <NewsPanels now={now} />
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
