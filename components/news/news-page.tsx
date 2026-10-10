"use client";

// /news: every recent official notice by kind, the stored patch history
// (backend patch-notice-v1, paged) and the running events. Titles open the
// official page; nothing of the notice body is copied.

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ExportCircle } from "@/components/ui/icons";
import { SiteHeader } from "@/components/site/site-header";
import { MINUTE, useClock } from "@/components/home/clock";
import home from "@/components/home/home.module.css";
import schedule from "@/components/schedule/schedule.module.css";
import { countdownText, retryLabel } from "@/lib/api/rate-limit";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import {
  fetchNews,
  fetchPatchNotes,
  NEWS_PAGE_LIMIT,
  newsPageKey,
  patchNotesKey,
} from "@/lib/home/client";
import {
  PATCH_CATEGORIES,
  PATCH_LABEL,
  noticeLabel,
  patchLabel,
  type PatchCategory,
} from "@/lib/home/model";
import { NOTICE_KINDS, newsPath, readNewsQuery, type NewsTab } from "@/lib/home/news";
import { EventItems, NoticeItem, shortDate } from "./news-parts";
import styles from "./news.module.css";

const OFFICIAL_NOTICES = "https://lostark.game.onstove.com/News/Notice/List";

function push(tab: NewsTab, kind: string | null) {
  window.history.pushState(null, "", newsPath(tab, kind));
}

const useNewsPage = () =>
  useQuery({
    queryKey: newsPageKey,
    queryFn: ({ signal }) => fetchNews(signal, NEWS_PAGE_LIMIT),
    staleTime: 5 * 60_000,
  });

function Failure({ error, what, retry }: { error: unknown; what: string; retry: () => void }) {
  const limit = useRateLimit(error);
  return (
    <div className={home.muted}>
      <p>{limit.limited ? countdownText(limit.seconds) : `${what} 불러오지 못했어요.`}</p>
      <button type="button" className={home.textButton} onClick={retry} disabled={limit.seconds > 0}>
        {retryLabel(limit.seconds)}
      </button>
    </div>
  );
}

function Notices({ kind }: { kind: string | null }) {
  const query = useNewsPage();
  const notices = query.data?.data.notices ?? [];
  const count = (k: string | null) => notices.filter((n) => !k || n.category === k).length;
  const shown = notices.filter((notice) => !kind || notice.category === kind);
  return (
    <>
      <div className={schedule.chips} role="group" aria-label="공지 분류">
        {[null, ...NOTICE_KINDS].map((k) => (
          <button
            key={k ?? "all"}
            type="button"
            aria-pressed={kind === k}
            onClick={() => push("notice", k)}
          >
            {k ? noticeLabel(k) : "전체"}
            {query.data && <span>{count(k)}</span>}
          </button>
        ))}
      </div>
      {query.isPending ? (
        <p className={home.muted}>공지를 불러오고 있어요…</p>
      ) : !query.data ? (
        <Failure error={query.error} what="공지를" retry={() => query.refetch()} />
      ) : shown.length === 0 ? (
        <p className={home.muted}>최근 공지 중 이 분류가 없어요.</p>
      ) : (
        <ul className={home.notices}>
          {shown.map((notice) => (
            <NoticeItem
              key={`${notice.publishedAt}${notice.title}`}
              title={notice.title}
              url={notice.url}
              publishedAt={notice.publishedAt}
              tag={noticeLabel(notice.category)}
              category={notice.category ?? undefined}
            />
          ))}
        </ul>
      )}
      <p className={styles.note}>
        공식 공지 최신 {NEWS_PAGE_LIMIT}개까지 보여 드려요. 그 전 공지는 공식 홈페이지에서 볼 수 있어요.
      </p>
    </>
  );
}

function PatchNotes({ kind }: { kind: PatchCategory | null }) {
  const query = useInfiniteQuery({
    queryKey: patchNotesKey(kind),
    queryFn: ({ pageParam, signal }) => fetchPatchNotes(kind, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const { page, size, total } = last.data;
      return page * size < total && page < 100 ? page + 1 : undefined;
    },
    staleTime: 5 * 60_000,
  });
  const pages = query.data?.pages ?? [];
  const items = pages.flatMap((page) => page.data.items);
  const first = pages[0]?.data;
  return (
    <>
      <div className={schedule.chips} role="group" aria-label="패치 분류">
        {[null, ...PATCH_CATEGORIES].map((k) => (
          <button
            key={k ?? "all"}
            type="button"
            aria-pressed={kind === k}
            onClick={() => push("patch", k)}
          >
            {k ? PATCH_LABEL[k] : "전체"}
          </button>
        ))}
      </div>
      {query.isPending ? (
        <p className={home.muted}>패치 이력을 불러오고 있어요…</p>
      ) : !first ? (
        <Failure error={query.error} what="패치 이력을" retry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <p className={home.muted}>아직 쌓인 패치 공지가 없어요.</p>
      ) : (
        <>
          <ul className={home.notices}>
            {items.map((item) => (
              <NoticeItem
                key={item.noticeId}
                title={item.title}
                url={item.url}
                publishedAt={item.publishedAt}
                tag={patchLabel(item.category)}
                category={item.category}
              />
            ))}
          </ul>
          {query.hasNextPage ? (
            <button
              type="button"
              className={styles.moreButton}
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
            >
              {query.isFetchingNextPage ? "불러오는 중…" : `더 보기 (${items.length}/${first.total})`}
            </button>
          ) : (
            <p className={styles.count}>{first.total}개 모두 보는 중</p>
          )}
          {query.isFetchNextPageError && (
            <p className={home.muted}>다음 목록을 불러오지 못했어요. 다시 눌러 주세요.</p>
          )}
        </>
      )}
      {first && (
        <p className={styles.note}>
          공식 API는 최근 약 3개월 공지만 줘서, 그 전 이력은 LOAKraken이 쌓기 시작한
          {first.firstObservedAt ? ` ${shortDate(first.firstObservedAt)}` : ""} 뒤부터 늘어나요.
          {first.oldestPublishedAt && ` 지금 가장 오래된 공지는 ${shortDate(first.oldestPublishedAt)}예요.`}
        </p>
      )}
    </>
  );
}

function Events({ renderedAt }: { renderedAt?: number }) {
  const now = useClock(MINUTE) ?? renderedAt ?? null;
  const query = useNewsPage();
  const events = query.data?.data.events;
  return (
    <section id="events" className={`${home.panel} ${styles.anchor}`} aria-labelledby="events-heading">
      <div className={home.panelHead}>
        <h2 id="events-heading">진행 중인 이벤트</h2>
        {events && <span className={home.count}>{events.length}개 · 끝나는 순</span>}
      </div>
      {query.isPending ? (
        <p className={home.muted}>이벤트를 불러오고 있어요…</p>
      ) : !events ? (
        <Failure error={query.error} what="이벤트를" retry={() => query.refetch()} />
      ) : events.length === 0 ? (
        <p className={home.muted}>진행 중인 이벤트가 없어요.</p>
      ) : (
        <EventItems events={events} now={now} />
      )}
    </section>
  );
}

export function NewsPage({ renderedAt }: { renderedAt?: number }) {
  const { tab, noticeKind, patchKind } = readNewsQuery(useSearchParams());
  return (
    <div className={home.page}>
      <a className={home.skip} href="#news-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="news-main" className={home.main}>
        <header className={schedule.head}>
          <h1>공지·이벤트</h1>
          <p className={schedule.reset}>
            로스트아크 공식 공지와 패치 이력, 진행 중인 이벤트예요. 제목을 누르면 공식 홈페이지 원문이 열려요.
          </p>
        </header>
        <div className={home.grid}>
          <section id="notices" className={`${home.panel} ${styles.anchor}`} aria-labelledby="notices-heading">
            <div className={home.panelHead}>
              <h2 id="notices-heading">{tab === "patch" ? "패치 이력" : "공지사항"}</h2>
              <a href={OFFICIAL_NOTICES} target="_blank" rel="noreferrer" className={home.more}>
                공식 공지 <ExportCircle size={14} aria-hidden="true" />
              </a>
            </div>
            <div className={home.noticeTabs} role="group" aria-label="공지 종류">
              <button type="button" aria-pressed={tab === "notice"} onClick={() => push("notice", null)}>
                공지사항
              </button>
              <button type="button" aria-pressed={tab === "patch"} onClick={() => push("patch", null)}>
                패치 이력
              </button>
            </div>
            {tab === "patch" ? <PatchNotes kind={patchKind} /> : <Notices kind={noticeKind} />}
          </section>
          <aside className={home.column} aria-label="진행 중인 이벤트">
            <Events renderedAt={renderedAt} />
          </aside>
        </div>
      </main>
    </div>
  );
}
