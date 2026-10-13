"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AddSquare,
  Bookmark,
  BookmarkBold,
  BookSquare,
  Box,
  Coffee,
  Flash,
  HierarchySquare,
  MagicStar,
  Tree,
  TrendUp,
} from "@/components/ui/icons";
import { GameIcon } from "@/components/character/imagery";
import { LandingMotion } from "@/components/landing/motion";
import { InlineOrb } from "@/components/landing/orb";
import {
  SORTS,
  boardQueryString,
  changeLabel,
  changeWithAmount,
  completedDays,
  goldText,
  TAB_FALLBACK,
  isTabId,
  unitPrice,
  type BoardItem,
  type BoardQuery,
  type ItemHistory,
  type MarketTab,
} from "@/lib/market/board";
import {
  MarketQueryError,
  fetchItemHistory,
  fetchMarketBoard,
  fetchMarketTabs,
} from "@/lib/market/client";
import { marketFailureCopy, type MarketFailure } from "@/lib/market/model";
import {
  favoritesSnapshot,
  parseFavorites,
  saveFavorite,
  subscribeFavorites,
  type FavoriteItem,
} from "@/lib/market/favorites";
import quote from "../tools/material-quote.module.css";
import { MarketChart } from "./market-chart";
import { SiteHeader } from "@/components/site/site-header";
import { PillTab, PillTabs } from "@/components/ui/pill-tabs";

// One Iconsax mark per category (decorative; the label names the tab).
const TAB_ICON: Record<string, ReactNode> = {
  REFINING: <MagicStar />,
  REFINING_EXTRA: <AddSquare />,
  ARK_GRID: <HierarchySquare />,
  WEAPON_EVOLUTION: <Flash />,
  ENGRAVING_BOOK: <BookSquare />,
  LIFE: <Tree />,
  BATTLE_ITEM: <Box />,
  FOOD: <Coffee />,
};
import styles from "./market.module.css";
import { rateLimitCopy, retryLabel } from "@/lib/api/rate-limit";
import { RateLimitNote } from "@/components/site/rate-limit-note";
import { pendingProps } from "@/lib/api/pending";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { useCrossfade } from "@/lib/motion";
import { ChangeMark, UpdateAnnouncer, useChangedCells, type Pulse } from "@/components/ui/changed-cells";
import { DataRefreshState } from "@/components/ui/data-refresh-state";

const TIERS = [4, 3] as const;

/**
 * A refresh failed while a list is on screen: the list stays (with its own
 * reference time) and only this line says so; the error screen is for when
 * there is nothing to show. After a 429 it counts down to Retry-After.
 */
function StaleNote({ failure }: { failure: MarketFailure }) {
  const limit = useRateLimit({ info: failure });
  return (
    <p className={styles.note} role="status">
      최신 값을 불러오지 못했어요 · {limit.seconds > 0 ? `${limit.seconds}초 뒤 다시 불러와요` : "1분 뒤 다시 불러와요"}
    </p>
  );
}
const failureOf = (error: unknown): MarketFailure | null =>
  error instanceof MarketQueryError
    ? error.info
    : error
      ? { code: "LOST_ARK_API_ERROR", status: 502 }
      : null;
const kst = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const at = (iso: string) => kst.format(new Date(iso));
function useFavorites() {
  const raw = useSyncExternalStore(subscribeFavorites, favoritesSnapshot, () => "[]");
  return useMemo(() => parseFavorites(raw), [raw]);
}
const quiet = {
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

function Change({
  value,
  item,
}: {
  value?: number | null;
  item?: Pick<BoardItem, "currentMinPrice" | "yesterdayAvgPrice" | "changeDay">;
}) {
  const label = item ? changeWithAmount(item) : changeLabel(value);
  return (
    <b className={styles.change} data-direction={label.direction}>
      {label.text}
    </b>
  );
}

/**
 * The day change in the detail facts: the amount on the big line and the
 * rate on a small line under it that is always there (a blank one when there
 * is no rate). The cell is narrower than "▲4.7 (4.8%)" at 18px, so the one
 * line used to fold into two on some refreshes and push the chart down
 * (A7, PM-프론트 #617); now it is two lines every time, neither wraps.
 */
function FactChange({ item }: { item: Pick<BoardItem, "currentMinPrice" | "yesterdayAvgPrice" | "changeDay"> }) {
  const label = changeWithAmount(item);
  const cut = label.text.indexOf(" (");
  const main = cut < 0 ? label.text : label.text.slice(0, cut);
  const rate = cut < 0 ? "" : label.text.slice(cut + 2, -1);
  return (
    <>
      <b className={styles.change} data-direction={label.direction}>
        {main}
      </b>
      <small className={styles.unit}>{rate || "\u00a0"}</small>
    </>
  );
}

function Problem({
  failure,
  onRetry,
}: {
  failure: MarketFailure;
  onRetry: () => void;
}) {
  const limit = useRateLimit({ info: failure });
  const copy = limit.limited ? rateLimitCopy() : marketFailureCopy(failure);
  return (
    <div className={quote.notice}>
      <div role="alert">
        <strong>{copy.title}</strong>
        <p>{copy.text}</p>
      </div>
      {limit.limited && <RateLimitNote seconds={limit.seconds} />}
      <button
        type="button"
        className={quote.outlinePill}
        onClick={onRetry}
        disabled={limit.seconds > 0}
      >
        {retryLabel(limit.seconds, "다시 불러오기")}
      </button>
    </div>
  );
}

function Detail({
  item,
  tier,
  tab,
  outside,
}: {
  item: BoardItem;
  tier: number | null;
  tab: FavoriteItem["tab"];
  outside?: boolean;
}) {
  const favorites = useFavorites();
  const starred = favorites.some((f) => f.itemId === item.itemId);
  const unit = unitPrice(item.currentMinPrice, item.bundleCount);
  const [range, setRange] = useState<7 | 14>(14);
  const [variantIndex, setVariantIndex] = useState(0);
  const history = useQuery({
    queryKey: ["market", "history", item.itemId],
    queryFn: ({ signal }) => fetchItemHistory(item.itemId, signal),
    staleTime: 10 * 60_000,
    ...quiet,
  });
  const data: ItemHistory | undefined = history.data?.data;
  const variant = data?.variants[Math.min(variantIndex, (data?.variants.length ?? 1) - 1)];
  const days = completedDays(variant, range);
  const fade = useCrossfade(history.isPending);
  // The browser tab carries the chosen item's price (checklist K36), so a
  // background tab still shows it. The page's own title can land after this
  // (streamed metadata), so it is set again whenever the head changes while
  // the item is shown; leaving the item puts the page title back.
  useEffect(() => {
    const previous = document.title;
    const wanted = `${goldText(item.currentMinPrice)} · ${item.name} | LOAKraken`;
    const apply = () => {
      if (document.title !== wanted) document.title = wanted;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = previous;
    };
  }, [item.name, item.currentMinPrice]);
  const failure = failureOf(history.error);
  return (
    <section className={styles.detail} aria-label={`${item.name} 시세`}>
      <header className={styles.detailHead}>
        <GameIcon src={item.icon} grade={item.grade} size={44} />
        <div>
          <strong data-grade={item.grade ?? undefined}>{item.name}</strong>
          <small>
            {[tier != null && `T${tier}`, item.grade].filter(Boolean).join(" · ")}
            {item.bundleCount > 1 && ` · ${item.bundleCount}개 묶음`}
          </small>
        </div>
        <button
          type="button"
          className={styles.star}
          aria-pressed={starred}
          aria-label={starred ? "즐겨찾기에서 빼기" : "즐겨찾기에 추가"}
          onClick={() =>
            saveFavorite({ itemId: item.itemId, name: item.name, tab, tier, icon: item.icon, grade: item.grade })
          }
        >
          {starred ? <BookmarkBold size={18} aria-hidden="true" /> : <Bookmark size={18} aria-hidden="true" />}
        </button>
      </header>
      {outside && (
        <p className={styles.note}>지금 목록 밖의 즐겨찾기 품목이에요. 최근 시세는 아래 추이에서 확인해요.</p>
      )}
      <dl className={styles.facts}>
        <div>
          <dt>현재 최저가</dt>
          <dd>
            {goldText(item.currentMinPrice)}
            {unit != null && <small className={styles.unit}>개당 {goldText(unit)}</small>}
          </dd>
        </div>
        <div>
          <dt>전일 평균 대비</dt>
          <dd>
            <FactChange item={item} />
          </dd>
        </div>
        <div>
          <dt>최근 거래가</dt>
          <dd>{goldText(item.recentPrice)}</dd>
        </div>
        <div>
          <dt>전일 평균가</dt>
          <dd>{goldText(item.yesterdayAvgPrice)}</dd>
        </div>
      </dl>

      <div className={styles.trendHead}>
        <h3>시세 추이</h3>
        <div className={styles.ranges} role="group" aria-label="기간">
          {([7, 14] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              onClick={() => setRange(value)}
            >
              {value}일
            </button>
          ))}
        </div>
      </div>
      {data && data.variants.length > 1 && (
        <div className={styles.ranges} role="group" aria-label="거래 조건">
          {data.variants.map((v, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={variantIndex === i}
              onClick={() => setVariantIndex(i)}
            >
              {v.tradeRemainCount != null
                ? `거래 ${v.tradeRemainCount}회`
                : `${v.bundleCount ?? 1}개`}
            </button>
          ))}
        </div>
      )}
      {failure ? (
        <Problem failure={failure} onRetry={() => history.refetch()} />
      ) : history.isPending ? (
        <>
          <p className={styles.chartPending} role="status">
            <InlineOrb /> 추이를 불러오고 있어요
          </p>
          {/* The 14-day table below the chart arrives with the history: hold its place. */}
          <div className={styles.dailyPending} aria-hidden="true" />
        </>
      ) : days.length ? (
        <div ref={fade}>
          <MarketChart days={days} />
        </div>
      ) : (
        <p className={styles.muted}>아직 수집된 시세가 없어요.</p>
      )}

      {variant && variant.days.length > 0 && (
        <table className={styles.daily}>
          <thead>
            <tr>
              <th scope="col">날짜</th>
              <th scope="col">평균 거래가</th>
              <th scope="col">거래량</th>
            </tr>
          </thead>
          <tbody>
            {variant.days.slice(0, range).map((day) => (
              <tr key={day.date} data-partial={day.partial || undefined}>
                <th scope="row">
                  {day.date.slice(5).replace("-", "/")}
                  {day.partial && <small> 집계 중</small>}
                </th>
                <td>{goldText(day.averagePrice)}</td>
                <td>{day.tradeCount.toLocaleString("ko-KR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data && (
        <p className={styles.note}>
          공식 거래소 일별 통계 · {at(data.observedAt)} 수집 · 가격은 묶음 기준
        </p>
      )}
    </section>
  );
}

/**
 * The board's rows. Each minute's refresh compares the prices with the last
 * ones: a changed current price or day change gets the shared changed-cell
 * mark (a wash that fades once, plus ▲/▼ on the price; the number is final
 * at once, no counting), and a screen reader hears one short summary.
 */
const washOnly = (pulse: Pulse | undefined): Pulse | undefined => pulse && { ...pulse, dir: 0 };

function BoardRows({
  items,
  tier,
  activeId,
  onChoose,
  listRef,
  pending,
}: {
  items: BoardItem[];
  tier: number | null;
  activeId: number | undefined;
  onChoose: (item: BoardItem) => void;
  listRef: ReturnType<typeof useCrossfade>;
  pending: ReturnType<typeof pendingProps>;
}) {
  const { pulse, summary } = useChangedCells(items, (item) => String(item.itemId), {
    price: (item) => item.currentMinPrice,
    change: (item) => item.changeDay,
  });
  return (
    <>
      <ul ref={listRef} className={styles.rows} {...pending}>
        {items.map((item) => (
          <li key={item.itemId}>
            <button type="button" aria-pressed={activeId === item.itemId} onClick={() => onChoose(item)}>
              <GameIcon src={item.icon} grade={item.grade} size={36} />
              <span className={styles.rowName}>
                <strong data-grade={item.grade ?? undefined}>
                  {item.name}
                  {tier != null && <i>T{tier}</i>}
                </strong>
                <small>
                  {item.bundleCount > 1 &&
                    `${item.bundleCount}개 · 개당 ${goldText(unitPrice(item.currentMinPrice, item.bundleCount))} · `}
                  최근 거래 {goldText(item.recentPrice).replace("G", "")}
                </small>
              </span>
              <span className={styles.rowPrice}>
                <ChangeMark pulse={pulse(String(item.itemId), "price")}>
                  <b>{goldText(item.currentMinPrice)}</b>
                </ChangeMark>
                {/* The day change carries its own ▲/▼: mark it with the wash only. */}
                <ChangeMark pulse={washOnly(pulse(String(item.itemId), "change"))}>
                  <Change item={item} />
                </ChangeMark>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <UpdateAnnouncer text={summary ? `시세 ${summary}` : ""} />
    </>
  );
}

function MarketContent({
  initial,
  initialItem,
}: {
  initial: BoardQuery;
  initialItem: number | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initial);
  const [selected, setSelected] = useState<number | null>(initialItem);
  const favorites = useFavorites();
  const tabs = useQuery({
    queryKey: ["market", "tabs"],
    queryFn: ({ signal }) => fetchMarketTabs(signal),
    staleTime: 10 * 60_000,
    ...quiet,
  });
  const tabList: MarketTab[] = (tabs.data?.data.tabs ?? []).filter((t) => isTabId(t.tab));
  const currentTab = tabList.find((t) => t.tab === query.tab);
  const tier = query.tier ?? currentTab?.defaultTier ?? null;
  const board = useQuery({
    queryKey: ["market", "board", query],
    queryFn: ({ signal }) => fetchMarketBoard(query, signal),
    staleTime: 30_000,
    // Prices move all day: refresh the open board every minute while the page
    // is visible (never in a background tab); changed prices tint briefly.
    refetchInterval: (q) => {
      const retryAt = failureOf(q.state.error)?.retryAt;
      return retryAt ? Math.max(60_000, retryAt - Date.now()) : 60_000;
    },
    placeholderData: keepPreviousData,
    ...quiet,
  });
  const data = board.data?.data;
  const fade = useCrossfade(!data);
  const items = data?.items ?? [];
  const listed = items.find((item) => item.itemId === selected);
  const favorite = !listed ? favorites.find((f) => f.itemId === selected) : undefined;
  // A starred item outside the current page still opens its history.
  const active: BoardItem | undefined =
    listed ??
    (favorite
      ? ({
          ...items[0],
          itemId: favorite.itemId,
          name: favorite.name,
          icon: favorite.icon,
          grade: favorite.grade,
          bundleCount: 1,
          currentMinPrice: null,
          recentPrice: null,
          yesterdayAvgPrice: null,
          changeDay: null,
          changeWeek: null,
        } as BoardItem)
      : items[0]);
  const pages = data ? Math.min(10, Math.ceil(data.totalItems / data.pageSize)) : 1;
  const failure = failureOf(board.error) ?? failureOf(tabs.error);

  function update(next: Partial<BoardQuery>, item: number | null = null) {
    const merged = { ...query, ...next };
    setQuery(merged);
    setSelected(item);
    const params = new URLSearchParams(boardQueryString(merged));
    if (item != null) params.set("item", String(item));
    router.replace(`?${params}`, { scroll: false });
  }
  function choose(item: BoardItem) {
    setSelected(item.itemId);
    const params = new URLSearchParams(boardQueryString(query));
    params.set("item", String(item.itemId));
    router.replace(`?${params}`, { scroll: false });
  }

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#market-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="market-main">
        <section className={quote.hero} aria-labelledby="market-heading">
          {/* Static mark like the tool screens: no repeating motion on information pages (D2). */}
          <span className={quote.heroIcon} aria-hidden="true">
            <TrendUp size={18} />
          </span>
          <p className={quote.heroKicker}>거래소</p>
          <h1 id="market-heading">시세</h1>
          <p className={quote.heroCopy}>
            공식 거래소 시세를 분류별로 모아 보여줘요.
          </p>
        </section>

        <div className={styles.band}>
          {(tabList.length > 0 || tabs.isPending) && (
            <PillTabs
              aria-label="시세 분류"
              value={query.tab}
              onValueChange={(tab) => update({ tab: tab as MarketTab["tab"], tier: null, page: 1 })}
            >
              {tabList.length
                ? tabList.map((t) => (
                    <PillTab key={t.tab} value={t.tab} icon={TAB_ICON[t.tab]}>
                      {t.label}
                    </PillTab>
                  ))
                : // Same names and sizes as the live list: nothing moves when it arrives.
                  TAB_FALLBACK.map((t) => (
                    <PillTab key={t.tab} value={t.tab} icon={TAB_ICON[t.tab]} disabled>
                      {t.label}
                    </PillTab>
                  ))}
            </PillTabs>
          )}
          {favorites.length === 0 ? (
            <p className={styles.favoritesHint}>
              <Bookmark size={12} aria-hidden="true" /> 품목의 즐겨찾기 표시를 누르면 여기에 모아 볼 수 있어요.
            </p>
          ) : (
            <ul className={styles.favorites} aria-label="즐겨찾기 품목">
              {favorites.map((f) => (
                <li key={f.itemId}>
                  <button
                    type="button"
                    aria-pressed={active?.itemId === f.itemId}
                    onClick={() => update({ tab: f.tab, tier: f.tier, sort: "default", page: 1 }, f.itemId)}
                  >
                    <Bookmark size={12} aria-hidden="true" />
                    <span data-grade={f.grade ?? undefined}>{f.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className={styles.columns}>
            <section className={styles.board} aria-labelledby="board-heading">
              <div className={styles.boardHead}>
                <h2 id="board-heading">
                  {data?.tabLabel ?? currentTab?.label ?? "시세"} 시세{" "}
                  {data && <small>{data.totalItems}종</small>}
                </h2>
                <div className={styles.sorts} role="group" aria-label="정렬">
                  {SORTS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={query.sort === s.id}
                      onClick={() => update({ sort: s.id, page: 1 })}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {(currentTab
                ? currentTab.defaultTier != null
                : TAB_FALLBACK.some((t) => t.tab === query.tab && t.tiered)) && (
                <div className={styles.tiers} role="group" aria-label="티어">
                  {TIERS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={tier === t}
                      onClick={() => update({ tier: t, page: 1 })}
                    >
                      T{t}
                    </button>
                  ))}
                </div>
              )}
              {(query.sort === "rise" || query.sort === "fall") && data && (
                <p className={styles.note}>
                  분류 전체를 스캔해 정렬해요(최대 3분 지연)
                  {!data.complete && " · 품목이 많아 일부 품목만 정렬했어요"}
                </p>
              )}
              {data && failure && <StaleNote failure={failure} />}
              {failure && !data ? (
                <Problem
                  failure={failure}
                  onRetry={() => {
                    void tabs.refetch();
                    void board.refetch();
                  }}
                />
              ) : !data ? (
                // One page of empty rows: the list keeps its height while loading.
                <ul className={styles.rows} aria-busy="true">
                  <li className={styles.srOnly} role="status">
                    시세를 불러오고 있어요
                  </li>
                  {Array.from({ length: 10 }, (_, i) => (
                    <li key={i} className={styles.skeletonRow} aria-hidden="true">
                      <i />
                      <span />
                    </li>
                  ))}
                </ul>
              ) : !items.length ? (
                <p className={styles.muted}>표시할 품목이 없어요.</p>
              ) : (
                // A new board (tab, tier, sort, page) is not a "change": the
                // rows are compared again from the first real answer for it.
                <BoardRows
                  key={`${JSON.stringify(query)}${board.isPlaceholderData ? ":previous" : ""}`}
                  listRef={fade}
                  items={items}
                  tier={tier}
                  activeId={active?.itemId}
                  onChoose={choose}
                  pending={pendingProps(board)}
                />
              )}
              {pages > 1 && (
                <nav className={styles.pages} aria-label="페이지">
                  {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-current={query.page === p ? "page" : undefined}
                      onClick={() => update({ page: p })}
                    >
                      {p}
                    </button>
                  ))}
                </nav>
              )}
              {data && (
                <div className={styles.freshness}>
                  <p className={styles.note}>{at(data.observedAt)} 기준 · 등락: 전일 평균가 대비</p>
                  {/* The board refreshes every minute on its own; this says how
                      old the shown prices are and asks again on demand, resting
                      30s after data arrives (the backend cache) so a press never
                      spends the official quota for the same numbers. */}
                  <DataRefreshState
                    label="시세 갱신"
                    updatedAt={board.dataUpdatedAt}
                    fetching={board.isFetching}
                    failed={board.isError}
                    onRefresh={() => void board.refetch()}
                  />
                </div>
              )}
            </section>

            <div className={styles.side}>
              {active ? (
                <Detail
                  key={active.itemId}
                  item={active}
                  tier={favorite ? favorite.tier : tier}
                  tab={favorite ? favorite.tab : query.tab}
                  outside={!!favorite}
                />
              ) : !data && !failure ? (
                // Board still loading: hold the detail panel height (it sits above
                // the board below 860px), so the board does not jump when it fills.
                <div className={styles.detailPending} aria-hidden="true" />
              ) : (
                <p className={styles.muted}>품목을 고르면 추이를 보여줘요.</p>
              )}
            </div>
          </div>
        </div>
      </main>
      <footer className={quote.footer}>
        공식 거래소 시세 기반
      </footer>
    </div>
  );
}

export function MarketBoardView(props: {
  initial: BoardQuery;
  initialItem: number | null;
}) {
  return (
    <LandingMotion>
      <MarketContent {...props} />
    </LandingMotion>
  );
}
