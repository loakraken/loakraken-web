"use client";

import { HubTabs } from "@/components/site/hub-tabs";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, BookmarkBold, StarBold, TrendUp } from "@/components/ui/icons";
import { GameIcon } from "@/components/character/imagery";
import { LandingMotion } from "@/components/landing/motion";
import { InlineOrb } from "@/components/landing/orb";
import {
  SORTS,
  BOOK_GRADES,
  boardQueryString,
  addressParams,
  parseItemId,
  parseRange,
  rangeParam,
  readBoardQuery,
  changeLabel,
  changeWithAmount,
  completedDays,
  openingVariant,
  termsKey,
  termsLabel,
  traded,
  windowStart,
  goldText,
  historyKey,
  chartRange,
  historyRange,
  OLD_RANGES,
  RANGE_LABEL,
  STORED_RANGES,
  TAB_FALLBACK,
  isTabId,
  unitPrice,
  type BoardItem,
  type BoardQuery,
  type ChartRange,
  type DayRange,
  type ItemHistory,
  type MarketTab,
} from "@/lib/market/board";
import {
  MarketQueryError,
  fetchItemHistory,
  fetchItemMinutes,
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
import { ChartPlaceholder, MarketChart, dayPoints, minutePoints, periodChange, rangeRowWidth, rangeWidth } from "./market-chart";
import { sampleText } from "@/lib/market/minutes";
import { SiteHeader } from "@/components/site/site-header";
import { BoardSearch } from "./board-search";
import { MarketCategoryRow } from "./category-row";
import { useTallest } from "@/components/ui/use-tallest";
import styles from "./market.module.css";
import { rateLimitCopy, retryLabel } from "@/lib/api/rate-limit";
import { RateLimitNote } from "@/components/site/rate-limit-note";
import { pendingProps } from "@/lib/api/pending";
import { useRateLimit } from "@/lib/api/use-rate-limit";
import { useCrossfade } from "@/lib/motion";
import { ChangeMark, UpdateAnnouncer, useChangedCells, type Pulse } from "@/components/ui/changed-cells";
import { DataRefreshState } from "@/components/ui/data-refresh-state";
import { PendingText } from "@/components/ui/pending-text";
import { BotNote } from "@/components/bot/bot-note";
import { FpEnd } from "@/components/ui/fp-end";
import { OverflowRow } from "@/components/ui/overflow-row";

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

/**
 * 기간 등락 under "시세 추이": the change over the chart's own period, by the
 * same rule as the line's colour (periodChange), with ▲/▼ and a sign so the
 * colour is never the only cue. The day change stays apart in the facts
 * above. The line is there from the first paint (a blank before the data), so
 * nothing moves when it arrives (A7).
 */
/**
 * The daily table's place while its answer loads: the same table (same header, empty rows), so it is
 * exactly the real table's height in whatever font is drawing (#1630).
 */
function PendingTable({ rows, sizer = false }: { rows: number; sizer?: boolean }) {
  return (
    <table className={`${styles.daily} ${sizer ? styles.dailySizer : styles.dailySkeleton}`} aria-hidden="true">
      <thead>
        <tr>
          <th scope="col">날짜</th>
          <th scope="col">평균 거래가</th>
          <th scope="col">거래량</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, i) => (
          <tr key={i}>
            <th scope="row">&nbsp;</th>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const rangeLabel = (value: ChartRange) => (value === "hour" ? "1시간" : RANGE_LABEL[value]);

function PeriodChange({ range, points }: { range: ChartRange; points: { value: number }[] | null }) {
  const label = range === "hour" ? "1시간" : RANGE_LABEL[range];
  const { direction, percent } = periodChange(points ?? []);
  if (!points || percent == null)
    return (
      <small className={`${styles.change} ${styles.periodChange}`} data-direction="none">
        {" "}
      </small>
    );
  const amount = Math.abs(percent).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "";
  const said = direction === "up" ? "올랐어요" : direction === "down" ? "내렸어요" : "그대로예요";
  return (
    <small className={`${styles.change} ${styles.periodChange}`} data-direction={direction}>
      <span className="sr-only">
        {label} 동안 {amount}% {said}
      </span>
      {/* One text node: split ones ('3개월', ' ', '▲', '12.3', '%') moved left when the label narrowed on a
          range switch (3개월 → 1년), a layout shift @360. */}
      <span aria-hidden="true">{`${label} ${arrow}${amount}%`}</span>
    </small>
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
  const copy = limit.limited ? rateLimitCopy(failure) : marketFailureCopy(failure);
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
  picked,
  onRange,
}: {
  item: BoardItem;
  tier: number | null;
  tab: FavoriteItem["tab"];
  outside?: boolean;
  /** The range picked for this item (the board keeps it in the address). */
  picked: ChartRange;
  onRange: (range: ChartRange) => void;
}) {
  const favorites = useFavorites();
  const starred = favorites.some((f) => f.itemId === item.itemId);
  const unit = unitPrice(item.currentMinPrice, item.bundleCount);
  // 1시간 (K35): the last hour by minute, from prices the warm-up already fetched.
  // Days (user 11-12, api #920): 7일 · 30일 · 3개월 · 1년; it opens on 30일.
  // The trade terms shown, by identity (termsKey): decided once per item from its first answer — the clicked
  // row's terms when they trade, else the most traded (QA 11-15) — and kept across ranges, whose answers list
  // their terms in their own order (codex #1671). A press picks other terms (`seen`: the range they were picked
  // in, which lists them).
  const [terms, setTerms] = useState<{ key: string; label: string; seen: DayRange | null } | null>(null);
  // Whether the api answers ranges: the 30-day answer (always read) echoes its range.
  const base = useQuery({
    queryKey: historyKey(item.itemId, "30d"),
    queryFn: ({ signal }) => fetchItemHistory(item.itemId, "30d", signal),
    staleTime: 10 * 60_000,
    ...quiet,
  });
  const stored = base.data ? base.data.data.range != null : true;
  const ranges: readonly ChartRange[] = stored ? STORED_RANGES : OLD_RANGES;
  // A range this api's buttons do not have reads as their opening one (30일, or an older api's 14일).
  const range = chartRange(picked, stored);
  const answer = range === "hour" ? "30d" : historyRange(range);
  const longer = useQuery({
    queryKey: historyKey(item.itemId, answer),
    queryFn: ({ signal }) => fetchItemHistory(item.itemId, answer, signal),
    enabled: answer !== "30d",
    staleTime: 10 * 60_000,
    // While a longer range loads, the chart shown stays (codex #1595 P2): the previous longer
    // answer, or the 30-day one when coming from 7일 · 30일.
    placeholderData: (previous) => previous ?? base.data,
    ...quiet,
  });
  const history = answer === "30d" ? base : longer;
  const data: ItemHistory | undefined = history.data?.data;
  // The range the shown data answers: the picked one once its answer is in, the last settled one
  // while a placeholder stands in (so the window and 'N일치' never come from the wrong answer).
  const [settled, setSettled] = useState<DayRange>(range === "hour" ? 30 : range);
  const ready = !history.isPlaceholderData && !history.isPending;
  if (ready && range !== "hour" && settled !== range) setSettled(range);
  // A placeholder is labelled by the answer it really is (codex #1595 delta: 3개월 → 1시간 → 1년 put the
  // 30-day answer under '3개월'): the last settled range if that range reads this answer, else its own days.
  const shownAnswer = data?.range;
  const placeholderRange: DayRange =
    shownAnswer == null || historyRange(settled) === shownAnswer ? settled : shownAnswer === "365d" ? 365 : shownAnswer === "90d" ? 90 : 30;
  const view: ChartRange = range === "hour" ? "hour" : ready ? range : placeholderRange;
  if (terms == null && data?.variants.length) {
    const opening = data.variants[openingVariant(data.variants, item)];
    setTerms({ key: termsKey(opening), label: termsLabel(opening), seen: null });
  }
  const listed = data ? data.variants.findIndex((v) => termsKey(v) === terms?.key) : -1;
  // Terms the user picked that this range does not list (stored-only ones, 30일+) stay picked: this range says
  // it has no record of them, and the pick comes back with a range that lists them (codex #1671 P3). The
  // opening terms, not a pick, give way to this answer's own.
  const missingPick = !!data && listed === -1 && terms?.seen != null;
  const variantIndex = listed !== -1 ? listed : missingPick ? -1 : data ? openingVariant(data.variants, item) : 0;
  const variant = variantIndex === -1 ? undefined : data?.variants[variantIndex];
  // Terms with days on record but no trade in them: say so, never a 0G line or 0G rows.
  const neverTraded = !!variant?.days.length && !variant.days.some(traded);
  const otherTraded = !!data?.variants.some((v, i) => i !== variantIndex && v.days.some(traded));
  const chartDays = view === "hour" ? 14 : view;
  // Days inside the range's calendar window (7일 reads the 30-day answer: rows, not dates, would
  // reach back weeks when records are sparse).
  const days = completedDays(variant, chartDays, stored ? data?.baseDate : undefined);
  // The table lists the latest days only (at most 14, in the same calendar window), and stays as
  // it was while the hour is shown.
  const tableDays = Math.min(chartDays, 14);
  const tableFrom = stored && data ? windowStart(data.baseDate, tableDays) : null;
  const tableRows = (variant?.days ?? []).filter((day) => traded(day) && (tableFrom == null || day.date >= tableFrom)).slice(0, tableDays);
  // Fewer days than the range: say how many there are; nothing is filled in (user 11-12).
  // (Today is partial and not charted, so a full range has range − 1 completed days.)
  const short = view !== "hour" && stored && days.length < view - 1 ? days.length : null;
  const minutes = useQuery({
    queryKey: ["market", "minutes", item.itemId],
    queryFn: ({ signal }) => fetchItemMinutes(item.itemId, signal),
    enabled: range === "hour",
    staleTime: 30_000,
    refetchInterval: range === "hour" ? 60_000 : false,
    ...quiet,
  });
  const minute = minutes.data?.data;
  const minuteFailure = failureOf(minutes.error);
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
  // An answer in and no traded day in the table's window (7일: the week; else the latest 14 days): one
  // notice, in the table's place, inside the table's own height; the chart keeps its empty frame (#1654).
  const emptyTable = !!data && !history.isPending && tableRows.length === 0;
  const emptyWeek = range === 7 && emptyTable;
  // What is missing, then the next step (ux-copy): other terms that trade, or 30일 for older days.
  const emptyNote = missingPick
    ? // Back to where the pick has records (ux-copy): the range it was picked in.
      `이 기간에는 이 조건의 기록이 없어요. ${RANGE_LABEL[terms!.seen!]}을 고르면 볼 수 있어요.`
    : neverTraded
    ? `이 조건으로는 거래된 기록이 없어요.${otherTraded ? " 다른 거래 조건을 골라 보세요." : ""}`
    : range === 7
      ? `최근 7일 동안 거래 기록이 없어요.${variant?.days.some(traded) ? " 30일을 고르면 지난 기록을 볼 수 있어요." : ""}`
      : "최근 14일 동안 거래 기록이 없어요.";
  // The latest days (at most 14) under the caption; each cell stays on one line (#1634), so its rows are
  // the skeleton's height at every width.
  // Drawn once whole (data-fp-whole, A7 rest sweep): the columns were measured again as each later row came in.
  const dailyTable = variant && variant.days.length > 0 && (
    <table className={styles.daily} data-fp-whole="">
      <thead>
        <tr>
          <th scope="col">날짜</th>
          <th scope="col">평균 거래가</th>
          <th scope="col">거래량</th>
        </tr>
      </thead>
      <tbody>
        {tableRows.map((day) => (
          <tr key={day.date} data-partial={day.partial || undefined}>
            <th scope="row">
              {day.date.slice(5).replace("-", "/")}
              {day.partial && (
                <small>
                  {" "}
                  <PendingText />
                </small>
              )}
            </th>
            <td>{goldText(day.averagePrice)}</td>
            <td>{day.tradeCount.toLocaleString("ko-KR")}</td>
          </tr>
        ))}
      </tbody>
      <FpEnd />
    </table>
  );
  return (
    <section className={styles.detail} aria-label={`${item.name} 시세`}>
      <header className={styles.detailHead}>
        <GameIcon src={item.icon} grade={item.grade} size={44} />
        {/* Drawn once whole (data-fp-whole, A7 rest sweep): the two lines are centred by the icon, so the second arriving moved the name up. */}
        <div data-fp-whole="">
          <strong data-grade={item.grade ?? undefined}>{item.name}</strong>
          <small>
            {[tier != null && `T${tier}`, item.grade].filter(Boolean).join(" · ")}
            {item.bundleCount > 1 && ` · ${item.bundleCount}개 묶음`}
          </small>
          <FpEnd />
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
        <div className={styles.trendTitle}>
          <h3>시세 추이</h3>
          <PeriodChange
            range={view}
            points={range === "hour" ? (minute ? minutePoints(minute.points) : null) : days.length ? dayPoints(days) : null}
          />
          {/* How many days the range has on record, by the period buttons so it is read before the chart
              (user 11-16); held from the first paint. */}
          <small className={`${styles.periodChange} ${styles.recordCount}`}>
            {short != null ? `${RANGE_LABEL[view as DayRange]} 중 ${short}일치 기록` : " "}
          </small>
        </div>
        {/* The row's width is set from its labels too, so a first HTML cut before the buttons draws it at its
            final width (rangeRowWidth). */}
        <div
          className={`${styles.ranges} ${styles.fixedRanges}`}
          role="group"
          aria-label="기간"
          style={rangeRowWidth(ranges.map(rangeLabel))}
        >
          {ranges.map((value) => {
            const label = rangeLabel(value);
            return (
              // Width by label length, not by the drawn text (rangeWidth).
              <button
                key={value}
                type="button"
                aria-pressed={range === value}
                onClick={() => onRange(value)}
                style={rangeWidth(label)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {/* The kept pick keeps the row even where this range lists no terms at all (codex #1675 P3). */}
      {data && (missingPick || data.variants.length > 1) && (
        <div className={styles.ranges} role="group" aria-label="거래 조건">
          {data.variants.map((v, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={variantIndex === i}
              onClick={() => setTerms({ key: termsKey(v), label: termsLabel(v), seen: view === "hour" ? settled : view })}
            >
              {termsLabel(v)}
            </button>
          ))}
          {/* The kept pick, last: still the choice (pressed), and nothing to press here — this range has no record
              of it (aria-disabled: still focusable and announced, codex #1675 P3). */}
          {missingPick && (
            <button type="button" aria-pressed="true" aria-disabled="true">
              {terms!.label}
            </button>
          )}
        </div>
      )}
      {range === "hour" ? (
        minuteFailure ? (
          <Problem failure={minuteFailure} onRetry={() => minutes.refetch()} />
        ) : !minute ? (
          <ChartPlaceholder busy>
            <InlineOrb /> 최근 1시간을 불러오고 있어요
          </ChartPlaceholder>
        ) : minutePoints(minute.points).length ? (
          <MarketChart
            key="hour"
            points={minutePoints(minute.points)}
            span={[Date.parse(minute.from), Date.parse(minute.to)]}
            label="최근 1시간 판매 최저가. 화살표 키로 분을 이동할 수 있어요."
          />
        ) : (
          <ChartPlaceholder>이 품목은 분 단위로 확인하지 않아요. 일 단위 추이를 봐 주세요.</ChartPlaceholder>
        )
      ) : failure ? (
        <Problem failure={failure} onRetry={() => history.refetch()} />
      ) : history.isPending ? (
        <ChartPlaceholder busy>
          <InlineOrb /> 추이를 불러오고 있어요
        </ChartPlaceholder>
      ) : days.length ? (
        <div ref={fade}>
          {/* Keyed by range and trade terms: each pick mounts a new chart, so it
              draws again (user 11-01; the character tabs and /stats draw once). */}
          <MarketChart key={`${view}-${variantIndex}`} points={dayPoints(days)} byDate />
        </div>
      ) : (
        // Same height as the chart (codex #1595 delta: an empty 7일 window swapped the chart for a short line).
        // A week with no day at all says so once, in the table's place below (PM, codex #1645): the chart keeps
        // its empty frame without a second message.
        <ChartPlaceholder>
          {emptyTable
            ? null
            : variant?.days.length
                ? `최근 ${RANGE_LABEL[view as DayRange] ?? ""} 기록이 없어요.`
                : "아직 수집된 시세가 없어요."}
        </ChartPlaceholder>
      )}

      {/* One line in both ranges, so switching keeps the table in place (A7). */}
      <p className={styles.chartCaption}>
        {range === "hour"
          ? [`판매 최저가`, sampleText(minute?.sampleEverySeconds), "확인하지 않은 분은 비어 있어요"].filter(Boolean).join(" · ")
          : "하루 평균 거래가와 거래량"}
      </p>
      {/* The 14-day table under the caption arrives with the history: hold its
          place, so the caption stays put when it lands (A7). */}
      {range === 7 ? (
        // 7일 (#1630, #1634): the 7-row table's own height from the press on, not the 14-row block shrinking
        // when the answer lands. While loading the skeleton shows; once the answer is in it stays as an unseen
        // size copy under the table, so a sparse week (3 rows) keeps the 7-row place (no rows made up).
        // An error drops the hold: the problem message takes the place. A week with no day at all says so
        // inside the same 7-row place, not a header over blank space (PM, codex #1635).
        <div className={styles.dailyHold}>
          {(history.isPending || data) && <PendingTable rows={7} sizer={!history.isPending} />}
          {emptyWeek ? <p className={styles.dailyEmpty}>{emptyNote}</p> : dailyTable}
        </div>
      ) : emptyTable ? (
        // 30일+ with no traded day in the latest 14 (codex #1671: a header over 0 rows collapsed the 14-row place):
        // the notice inside the same place.
        <div className={styles.dailyHold}>
          <PendingTable rows={14} sizer />
          <p className={styles.dailyEmpty}>{emptyNote}</p>
        </div>
      ) : (
        <>
          {/* The 14-row table's own skeleton: exactly the table's height (codex #1671 P3: a fixed 502px block
              was 0.4px off the 502.4px table). */}
          {history.isPending && <PendingTable rows={14} />}
          {dailyTable}
        </>
      )}
      {data && (
        <p className={styles.note}>
          {view !== "hour" && view > 14 ? "공식 거래소 일별 통계와 LOAKraken 저장 기록" : "공식 거래소 일별 통계"} ·{" "}
          {at(data.observedAt)} 수집 · 가격은 묶음 기준
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
 * A starred item carries a filled star before its name in every list (user
 * 11-02, PM screenshot check: the icon-corner mark was too small to see).
 */
const washOnly = (pulse: Pulse | undefined): Pulse | undefined => pulse && { ...pulse, dir: 0 };

function BoardRows({
  items,
  tier,
  activeId,
  starred,
  onChoose,
  listRef,
  pending,
}: {
  items: BoardItem[];
  tier: number | null;
  activeId: number | undefined;
  starred: ReadonlySet<number>;
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
                  {/* The star's place is kept on every row (hidden when not starred):
                      favourites are read in the browser after the first paint, and a
                      star appearing then moved the name ~19px (codex review). */}
                  <StarBold
                    size={15}
                    className={styles.rowStar}
                    data-starred={starred.has(item.itemId) || undefined}
                    aria-hidden="true"
                  />
                  {item.name}
                  {/* One string, sized from the start tag (data-fp-label): a badge drawn
                      before its text was a 2px sliver that grew and moved (A7). */}
                  {tier != null && <i data-fp-label={`T${tier}`}><span>{`T${tier}`}</span></i>}
                  {starred.has(item.itemId) && <span className="sr-only"> · 즐겨찾기됨</span>}
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
  // The address is the board's state: picks write it in place (replaceState, below), and Back / Forward
  // restore an entry whose server props are those of its first render (QA 11-15: /market → 요리 → 보석 →
  // Back showed 재련 재료 under /market?tab=FOOD). So the query and the picked item are read from the
  // address at mount and again whenever the address changes without the board writing it; the props
  // only seed the server render, where the address and the props agree.
  const searchParams = useSearchParams();
  const address = searchParams.toString();
  const fromAddress = () => {
    const params = addressParams(searchParams);
    const item = typeof params.item === "string" ? parseItemId(params.item) : null;
    const range = parseRange(params.range);
    return { query: readBoardQuery(params), item, chart: range === 30 ? null : { item, range } };
  };
  const [query, setQuery] = useState(() => (address ? fromAddress().query : initial));
  const [selected, setSelected] = useState<number | null>(() => (address ? fromAddress().item : initialItem));
  // The chart range picked for an item (null item: the item shown, for an address without one). In the address
  // too, so Back from another page — which mounts the board anew — keeps it (codex #1669 P3). Another item opens
  // on 30일, as it always did.
  const [chart, setChart] = useState<{ item: number | null; range: ChartRange } | null>(() =>
    address ? fromAddress().chart : null,
  );
  // The board's own writes still on their way: Next updates useSearchParams later, inside a transition
  // (codex #1669 P1: marking the new address as known at once made the next render re-read the OLD one and
  // flash the previous board). An arriving address equal to the newest of them is the board's own (already
  // in state: re-reading it would also normalise a search being typed); any other is re-read (Back, Forward,
  // a link, a push).
  const [pending, setPending] = useState<readonly string[]>([]);
  const [known, setKnown] = useState<string | null>(address);
  // Back / Forward is never the board's own write: whatever was still pending is dropped and the address is
  // re-read even when it equals the last one seen — a Back inside a pick's transition restores the address
  // the board had before the pick (codex #1669 round 4). The re-read also mounts the search box anew, which
  // cancels a search still waiting to be sent.
  useEffect(() => {
    const drop = () => {
      setPending([]);
      setKnown(null);
    };
    window.addEventListener("popstate", drop);
    return () => window.removeEventListener("popstate", drop);
  }, []);
  // The search box keeps its own text and debounce: a re-read address mounts it anew (codex #1669 P2).
  const [searchKey, setSearchKey] = useState(0);
  if (address !== known) {
    setKnown(address);
    // Only the NEWEST pending write is the board's own (codex #1669 round 3): an older entry, a router push
    // or a Back whose render lands before the popstate listener is re-read. Either way nothing stays pending.
    setPending([]);
    if (address !== pending.at(-1)) {
      const next = fromAddress();
      setQuery(next.query);
      setSelected(next.item);
      setChart(next.chart);
      setSearchKey((key) => key + 1);
    }
  }
  const [heldRef, held] = useTallest();
  const favorites = useFavorites();
  const starred = useMemo(() => new Set(favorites.map((f) => f.itemId)), [favorites]);
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
    // While the next page or sort loads the rows stay; another category or grade never shows the last
    // one's rows under its name (codex #1669 P2: an uncached Back kept the previous board until its answer).
    placeholderData: (previous, previousQuery) => {
      const last = previousQuery?.queryKey[2] as BoardQuery | undefined;
      return last && last.tab === query.tab && last.grade === query.grade ? previous : undefined;
    },
    ...quiet,
  });
  const data = board.data?.data;
  // The last answer shown, to hold the freshness line's place while another category loads.
  const [lastBoard, setLastBoard] = useState(data);
  if (data && data !== lastBoard) setLastBoard(data);
  // Whether the api answers the grade filter: decided once, from any answer that echoes `grade`, so a
  // failed grade read keeps the buttons that lead back (codex #1603 P2).
  const [gradeReady, setGradeReady] = useState(false);
  if (!gradeReady && data && "grade" in data) setGradeReady(true);
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
  const chartRange: ChartRange =
    active && chart && (chart.item == null || chart.item === active.itemId) ? chart.range : 30;
  const pages = data ? Math.min(10, Math.ceil(data.totalItems / data.pageSize)) : 1;
  const failure = failureOf(board.error) ?? failureOf(tabs.error);

  // The address follows the board with a plain replaceState: router.replace
  // asked this dynamic page again and re-mounted it, so the pager and footer
  // vanished and came back when a search answer landed (#1115 measure, CLS).
  const follow = (params: URLSearchParams) => {
    setPending((writes) => [...writes, params.toString()]);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  };
  function update(next: Partial<BoardQuery>, item: number | null = null) {
    const merged = { ...query, ...next };
    setQuery(merged);
    setSelected(item);
    setChart(null);
    const params = new URLSearchParams(boardQueryString(merged));
    if (item != null) params.set("item", String(item));
    follow(params);
  }
  // The item's chart range, written next to the item (a range always names its item in the address).
  function show(itemId: number, range: ChartRange) {
    setSelected(itemId);
    setChart(range === 30 ? null : { item: itemId, range });
    const params = new URLSearchParams(boardQueryString(query));
    params.set("item", String(itemId));
    const value = rangeParam(range);
    if (value) params.set("range", value);
    follow(params);
  }
  // Another item opens on 30일; the open one keeps its range.
  const choose = (item: BoardItem) => show(item.itemId, item.itemId === active?.itemId ? chartRange : 30);

  return (
    <div className={quote.page}>
      <a className={quote.skip} href="#market-main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="market-main">
        <section className={quote.hero} aria-labelledby="market-heading">
          <p className={quote.heroKicker}>거래소</p>
          <h1 id="market-heading">시세</h1>
          <p className={quote.heroCopy}>
            공식 거래소 시세를 분류별로 모아 보여줘요.
          </p>
          {/* Static mark like the tool screens: no repeating motion on information pages (D2). */}
          <span className={quote.heroIcon} aria-hidden="true">
            <TrendUp size={18} />
          </span>
          <HubTabs hub="market" />
        </section>

        <div className={styles.band}>
          {/* Exchange categories switch here; 보석 · 장신구 open their own pages (user 11-12). */}
          <MarketCategoryRow value={query.tab} onExchange={(tab) => update({ tab, tier: null, page: 1, grade: null })} />
          {favorites.length === 0 ? (
            // In the bar's own 30px row: saved favourites replace it after
            // loading (browser storage), so it must be no taller than them.
            <BotNote mood="calm" inline className={styles.favoritesNote}>
              <p className={styles.favoritesHint}>
                <Bookmark size={12} role="img" aria-label="즐겨찾기" /> 표시를 누르면 여기에 모여요
              </p>
            </BotNote>
          ) : (
            // Scrolls sideways when the favourites outgrow the line (OverflowRow): ‹ › on a mouse, drag,
            // the shown item's favourite in view (no first-paint script: storage, browser only).
            <OverflowRow reveal="[aria-pressed=true]" revealKey={active?.itemId} revealScript={false}>
              <ul className={styles.favorites} aria-label="즐겨찾기 품목">
                {favorites.map((f) => (
                  <li key={f.itemId}>
                    <button
                      type="button"
                      aria-pressed={active?.itemId === f.itemId}
                      onClick={() => update({ tab: f.tab, tier: f.tier, sort: "default", page: 1, grade: null }, f.itemId)}
                    >
                      <Bookmark size={12} aria-hidden="true" />
                      <span data-grade={f.grade ?? undefined}>{f.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </OverflowRow>
          )}

          <div className={styles.columns}>
            {/* The detail comes first in the page, as phones show it (above the
                board). After the board, a slow page arrived in two parts and
                the detail, drawn in above it later, pushed the drawn board off
                the screen before the page woke (#1353, CLS 0.55 at 320). Wide
                screens still place the board left, the detail right. */}
            <div className={styles.side}>
              {active ? (
                <Detail
                  key={active.itemId}
                  item={active}
                  tier={favorite ? favorite.tier : tier}
                  tab={favorite ? favorite.tab : query.tab}
                  outside={!!favorite}
                  picked={chartRange}
                  onRange={(range) => show(active.itemId, range)}
                />
              ) : !data && !failure ? (
                // Board still loading: hold the detail panel height (it sits above
                // the board below 860px), so the board does not jump when it fills.
                <div className={styles.detailPending} aria-hidden="true" />
              ) : (
                <p className={styles.muted}>품목을 고르면 추이를 보여줘요.</p>
              )}
            </div>
            <section className={styles.board} aria-labelledby="board-heading">
              {/* Drawn once whole (data-fp-whole, A7 rest sweep): the heading is centred against the sort
                  pill, and the count and the pill arriving after the name moved it down 6px (1280). */}
              <div className={styles.boardHead} data-fp-whole="">
                {/* Drawn anew per kind: its text changes in place otherwise and
                    counts as moving (A7). */}
                <h2 id="board-heading" key={`${data?.tabLabel ?? currentTab?.label}-${data?.totalItems}`}>
                  {`${data?.tabLabel ?? currentTab?.label ?? "시세"} 시세 `}
                  {data && <small>{`${data.totalItems}종`}</small>}
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
                <FpEnd />
              </div>
              {/* Searches the open tab; tab, tier and sort stay and apply to
                  the results, a new search starts at page 1 (#1115). */}
              <BoardSearch
                key={searchKey}
                value={query.q}
                onSearch={(q) => update({ q, page: 1 })}
                notice={
                  query.q && data && !board.isPlaceholderData && !data.complete
                    ? "품목이 많아 일부 품목만 찾았어요."
                    : null
                }
              />
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
              {/* 각인서 by grade (user 11-12): only when the api answers the filter (it echoes
                  `grade`); an older api never shows a filter it would ignore. */}
              {query.tab === "ENGRAVING_BOOK" && gradeReady && (
                <div className={styles.tiers} role="group" aria-label="등급">
                  {([null, ...BOOK_GRADES] as const).map((g) => (
                    <button
                      key={g ?? "all"}
                      type="button"
                      aria-pressed={query.grade === g}
                      onClick={() => update({ grade: g, page: 1 })}
                    >
                      {g ?? "전체"}
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
              {/* The list and its pager held at their tallest on this visit: a
                  shorter answer (a search, a last page) or a pager going away
                  never pulls up the price note and the footer when it lands,
                  well after the key press (A7, #1115 measure). Drawn anew per
                  board, as the rows are: a note or the tier row coming and
                  going above it then adds a new box instead of moving this one
                  (a7-controls, 정렬/상승 and tab presses). */}
              <div key={JSON.stringify(query)} ref={heldRef} style={held ? { minHeight: held } : undefined}>
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
                <BotNote mood="puzzled">
                  <p className={styles.muted} role="status">
                    {query.q
                      ? `‘${query.q}’에 맞는 품목이 이 분류에 없어요. 다른 분류에서 찾아볼까요?`
                      : "표시할 품목이 없어요. 다른 분류를 골라 보세요."}
                  </p>
                </BotNote>
              ) : (
                // A new board (tab, tier, sort, page) is not a "change": the
                // rows are compared again from the first real answer for it.
                <BoardRows
                  key={`${JSON.stringify(query)}${board.isPlaceholderData ? ":previous" : ""}`}
                  listRef={fade}
                  items={items}
                  tier={tier}
                  activeId={active?.itemId}
                  starred={starred}
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
              </div>
              {(data ?? (!failure && lastBoard)) && (
                // While another category loads, the line keeps its box (unseen, the last answer's own text, so it
                // wraps the same): it vanished and came back, moving the page below (codex #1669 delta).
                <div
                  className={styles.freshness}
                  style={data ? undefined : { visibility: "hidden" }}
                  aria-hidden={data ? undefined : true}
                >
                  <p className={styles.note}>{at((data ?? lastBoard)!.observedAt)} 기준 · 등락: 전일 평균가 대비</p>
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
