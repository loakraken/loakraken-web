"use client";

// 최저가 추이 for one gem or accessory board cell (user 11-12, api #920): the
// lowest buy-now price LOAKraken last saw each day, 7일 · 30일 · 3개월 · 1년.
// Only days somebody opened the cell have a reading: a short range draws the
// days there are and says how many ('3개월 중 12일치 기록', under the title by
// the period buttons); a missing day is a gap on the date axis, never a zero,
// bridged by a faint dashed line that reads '이날은 기록이 없어요' (user 11-16).
// The box is there before a cell is picked and when the history cannot be read
// (an api before #920), so nothing below moves (A7).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChartPlaceholder, MarketChart, rangeRowWidth, rangeWidth, type ChartPoint } from "./market-chart";
import { InlineOrb } from "@/components/landing/orb";
import { FpEnd } from "@/components/ui/fp-end";
import {
  CELL_RANGES,
  CELL_RANGE_LABEL,
  completedCellDays,
  shortOf,
  type CellDay,
  type CellHistoryEnvelope,
  type CellRange,
} from "@/lib/market/cell-history";
import market from "./market.module.css";

const dayLabel = (date: string) => {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
};

/** One reading a day: the price line only (the count is listings, not trades: no bars). */
export const cellPoints = (days: readonly CellDay[]): ChartPoint[] =>
  days.map((day) => ({
    key: day.date,
    value: day.minBuyPrice,
    volume: null,
    axis: dayLabel(day.date),
    detail: `${day.date} · 매물 ${day.totalCount.toLocaleString("ko-KR")}개`,
    t: Date.parse(`${day.date}T00:00:00Z`),
  }));

export function CellTrend({
  name,
  queryKey,
  load,
  note,
}: {
  /** The picked cell ('10레벨 겁화'); null before a cell is picked. */
  name: string | null;
  queryKey: readonly unknown[];
  load: ((range: CellRange, signal: AbortSignal) => Promise<CellHistoryEnvelope>) | null;
  /**
   * What this board says about its missing days, from the readings' days (accessories: a day is on record
   * only if someone opened the cell, before the warmup). Given, it holds its own caption line even when it
   * says nothing, so switching ranges moves nothing (A7).
   */
  note?: (times: readonly number[]) => string | null;
}) {
  const [range, setRange] = useState<CellRange>(30);
  const history = useQuery({
    queryKey: [...queryKey, range],
    queryFn: ({ signal }) => load!(range, signal),
    enabled: load != null,
    staleTime: 10 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const days = completedCellDays(history.data?.data);
  // The count only from an answer in hand (codex #1601 P2-1): before a cell, while loading or after a
  // failure the line stays blank (its place held), never '0일치'.
  const short = history.isSuccess ? shortOf(days, range) : null;
  const points = cellPoints(days);
  const gapNote = note && history.isSuccess ? note(points.map((p) => p.t!)) : null;
  return (
    <section className={market.cellTrend} aria-label={name ? `${name} 최저가 추이` : "최저가 추이"}>
      <div className={market.trendHead}>
        <div className={`${market.trendTitle} ${market.countedTitle}`}>
          <h3>최저가 추이</h3>
          <small className={`${market.periodChange} ${market.recordCount}`}>
            {short != null ? `${CELL_RANGE_LABEL[range]} 중 ${short}일치 기록` : " "}
          </small>
        </div>
        {/* Drawn once whole (data-fp-whole): the group sits at the row's right end, so each button that
            came later pushed the ones already drawn to the left (A7, market boards sweep). */}
        <div
          className={`${market.ranges} ${market.fixedRanges}`}
          role="group"
          aria-label="기간"
          data-fp-whole=""
          style={rangeRowWidth(CELL_RANGES.map((value) => CELL_RANGE_LABEL[value]))}
        >
          {CELL_RANGES.map((value) => (
            // Width by label length, not by the drawn text, as the market chart's row (#1628).
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              disabled={!load}
              onClick={() => setRange(value)}
              style={rangeWidth(CELL_RANGE_LABEL[value])}
            >
              {CELL_RANGE_LABEL[value]}
            </button>
          ))}
          <FpEnd />
        </div>
      </div>
      {!load ? (
        <ChartPlaceholder>위 표에서 칸을 고르면 그 칸의 최저가 추이를 보여 드려요.</ChartPlaceholder>
      ) : history.isPending ? (
        <ChartPlaceholder busy>
          <InlineOrb /> 추이를 불러오고 있어요
        </ChartPlaceholder>
      ) : history.isError ? (
        <ChartPlaceholder>기간 기록은 아직 준비 중이에요. 아래 매물은 지금 시세예요.</ChartPlaceholder>
      ) : days.length > 1 ? (
        <MarketChart
          key={`${name}-${range}`}
          points={points}
          byDate
          label="그날 마지막으로 확인한 즉시 구매 최저가. 화살표 키로 날짜를 이동할 수 있어요."
        />
      ) : (
        <ChartPlaceholder>아직 쌓인 기록이 적어요. 이 칸을 본 날마다 하루 한 번 기록해요.</ChartPlaceholder>
      )}
      {/* A fixed sentence (it may wrap at 320, never cut: A37); then, where the board gives a note on its
          missing days, its own line, held when empty, so switching ranges moves nothing below (A7). */}
      <p className={`${market.chartCaption} ${market.cellCaption}`}>
        그날 마지막으로 확인한 즉시 구매 최저가 · LOAKraken 기록(공식 일평균 아님)
      </p>
      {note && (
        <p className={`${market.chartCaption} ${market.cellCaption}`} data-gap-note="">
          {gapNote ?? " "}
        </p>
      )}
    </section>
  );
}
