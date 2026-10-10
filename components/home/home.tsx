"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  TriangleAlert,
} from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { Hero } from "@/components/landing/hero";
import { MotionScope } from "@/components/landing/motion-context";
import landing from "@/components/landing/landing.module.css";
import { fetchNews, homeNewsKey } from "@/lib/home/client";
import {
  noticeLabel,
  upcomingMaintenance,
  isPatchNote,
} from "@/lib/home/model";
import { fetchMarketBoard } from "@/lib/market/client";
import { changeLabel, goldText } from "@/lib/market/board";
import { ScheduleBoard } from "@/components/schedule/schedule-board";
import { EventItems, NoticeItem } from "@/components/news/news-parts";
import { MINUTE, useClock } from "./clock";
import { RecentCard } from "./recent-card";
import { PopularCard } from "./popular-card";
import { ServerCard } from "./server-card";
import styles from "./home.module.css";
import { countdownText } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";

const useNews = () =>
  useQuery({
    queryKey: homeNewsKey,
    queryFn: ({ signal }) => fetchNews(signal),
    staleTime: 5 * 60_000,
  });

/** Shown only on the maintenance day itself, above everything else. */
/**
 * Today/tomorrow maintenance. Decided from the server render time until the
 * client clock starts, so the banner is already in the first HTML and never
 * pushes the page down after hydration (CLS, QA #181).
 */
function MaintenanceBanner({ renderedAt }: { renderedAt?: number }) {
  const now = useClock(MINUTE) ?? renderedAt ?? null;
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
      <Warning size={16} aria-hidden="true" />
      <span>
        <b>{upcoming.when === "today" ? "오늘 점검" : "내일 점검"}</b> {maintenance.title}
      </span>
      <ChevronRight size={14} aria-hidden="true" />
    </a>
  );
}

function NewsPanels({ renderedAt }: { renderedAt?: number }) {
  const now = useClock(MINUTE) ?? renderedAt ?? null;
  const query = useNews();
  const limit = useRateLimit(query.error);
  const data = query.data?.data;
  const [noticeTab, setNoticeTab] = useState<"notice" | "patch">("notice");
  const shownNotices = (data?.notices ?? [])
    .filter((notice) => isPatchNote(notice) === (noticeTab === "patch"))
    .slice(0, 6);
  return (
    <>
      <section
        id="news"
        className={styles.panel}
        aria-labelledby="notice-heading"
      >
        <div className={styles.panelHead}>
          <h2 id="notice-heading">공지사항</h2>
          <Link href="/news" className={styles.more}>
            전체 보기 <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className={styles.noticeTabs} role="group" aria-label="공지 종류">
          <button type="button" aria-pressed={noticeTab === "notice"} onClick={() => setNoticeTab("notice")}>
            공지
          </button>
          <button type="button" aria-pressed={noticeTab === "patch"} onClick={() => setNoticeTab("patch")}>
            패치노트
          </button>
        </div>
        {!data ? (
          <p className={styles.muted}>
            {query.isPending
              ? "공지를 불러오고 있어요…"
              : limit.limited
                ? countdownText(limit.seconds)
                : "공지를 불러오지 못했어요."}
          </p>
        ) : shownNotices.length === 0 ? (
          <p className={styles.muted}>
            {noticeTab === "patch" ? "최근 패치노트가 없어요." : "최근 공지가 없어요."}
          </p>
        ) : (
          <ul className={styles.notices}>
            {shownNotices.map((notice) => (
              <NoticeItem
                key={`${notice.publishedAt}${notice.title}`}
                title={notice.title}
                url={notice.url}
                publishedAt={notice.publishedAt}
                tag={noticeTab === "patch" ? "패치" : noticeLabel(notice.category)}
                category={notice.category ?? undefined}
              />
            ))}
          </ul>
        )}
      </section>
      <section className={styles.panel} aria-labelledby="event-heading">
        <div className={styles.panelHead}>
          <h2 id="event-heading">진행 중인 이벤트</h2>
          <Link href="/news#events" className={styles.more}>
            {data ? `${data.events.length}개 전체 보기` : "전체 보기"}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {!data ? (
          <p className={styles.muted}>
            {query.isPending
              ? "이벤트를 불러오고 있어요…"
              : limit.limited
                ? countdownText(limit.seconds)
                : "이벤트를 불러오지 못했어요."}
          </p>
        ) : data.events.length === 0 ? (
          <p className={styles.muted}>진행 중인 이벤트가 없어요.</p>
        ) : (
          <EventItems events={data.events} now={now} />
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
        { tab: "REFINING", tier: null, sort: "default", page: 1 },
        signal,
      ),
    staleTime: 5 * 60_000,
  });
  const limit = useRateLimit(query.error);
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
            : limit.limited
              ? countdownText(limit.seconds)
              : "시세를 불러오지 못했어요."}
        </p>
      ) : (
        <ul className={styles.market}>
          {items.map((item) => {
            const change = changeLabel(item.changeDay);
            return (
              <li key={item.itemId}>
                <Link href="/market?tab=REFINING">
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

export function HomeDashboard({ renderedAt }: { renderedAt?: number }) {
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#home-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="home-main" className={styles.main}>
        <h1 className={styles.srOnly}>로스트아크 캐릭터 검색</h1>
        {/* The /about hero on top of the dashboard (user, 11:05). */}
        <MotionScope>
          <div className={landing.landing} data-embedded="">
            <Hero embedded />
          </div>
        </MotionScope>
        <MaintenanceBanner renderedAt={renderedAt} />
        <div className={styles.grid}>
          <div className={styles.column}>
            <ScheduleBoard renderedAt={renderedAt} />
            <MarketSummary />
          </div>
          <aside className={styles.column} aria-label="공지와 이벤트">
            <RecentCard />
            <PopularCard />
            <NewsPanels renderedAt={renderedAt} />
            <ServerCard />
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
