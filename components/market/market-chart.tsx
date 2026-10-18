"use client";

import { useCallback, useId, useMemo, useState, type ReactNode } from "react";
import { curve } from "@/components/ui/bencho/balance-curve";
import { ChartTooltip, useChartScrub } from "@/components/ui/chart-scrub";
import { niceTicks } from "@/lib/character/history";
import type { DailyStat } from "@/lib/market/board";
import { minuteLabel, type MinutePoint } from "@/lib/market/minutes";
import styles from "./market.module.css";

const DEFAULT_W = 560;
const PRICE_H = 170;
const VOLUME_H = 54;
const GAP = 10;
const H = PRICE_H + GAP + VOLUME_H + 22;
const PAD = { left: 8, right: 52, top: 10 };
const fmt = (v: number) =>
  v.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
const short = (date: string) => {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
};

/**
 * A message in the chart's own frame (same box, drawing height and reading
 * line): loading, or nothing to draw. Built like the chart, so it is the
 * chart's height at every width and font, and swapping one for the other
 * moves nothing under it (A7).
 */
export function ChartPlaceholder({ children, busy = false }: { children: ReactNode; busy?: boolean }) {
  return (
    <figure className={styles.chart} {...(busy && { role: "status" })}>
      <div className={styles.chartMessage} style={{ height: H }}>
        {children}
      </div>
      <p className={styles.readout} aria-hidden="true">
        <strong>&nbsp;</strong>
      </p>
    </figure>
  );
}

/** One reading on the chart: a day, or a minute (K35). */
export type ChartPoint = {
  key: string;
  value: number;
  /** Trade count under the line; null draws no bar (minutes have none). */
  volume: number | null;
  /** Short label for the axis ends ("10/14", "14:05"). */
  axis: string;
  /** What the readout says after the price. */
  detail: string;
  /** Time in ms: points placed by time (minutes, with gaps), else evenly. */
  t?: number;
};

export const dayPoints = (days: DailyStat[]): ChartPoint[] =>
  days.map((d) => ({
    key: d.date,
    value: d.averagePrice,
    volume: d.tradeCount,
    axis: short(d.date),
    detail: `${d.date} · 거래량 ${d.tradeCount.toLocaleString("ko-KR")}`,
  }));

/** Minutes with a sell price only; a minute without listings has no point. */
export const minutePoints = (points: MinutePoint[]): ChartPoint[] =>
  points.flatMap((p) =>
    p.currentMinPrice == null
      ? []
      : [
          {
            key: p.minute,
            value: p.currentMinPrice,
            volume: null,
            axis: minuteLabel(p.minute),
            // Short enough for one line at 360 (the caption says the price is the lowest listing).
            detail: `${minuteLabel(p.minute)}${p.recentPrice != null ? ` · 최근 거래 ${fmt(p.recentPrice)}G` : ""}`,
            t: Date.parse(p.minute),
          },
        ],
  );

/**
 * The change over the chart's own period, first reading to last: what the
 * line's colour says (up red, down blue). The period label beside the chart
 * uses the same numbers, so the colour and the words never disagree (user
 * 10-16: a red line on a day that fell, because the number beside it was the
 * day change).
 */
export function periodChange(points: readonly { value: number }[]) {
  if (points.length < 2) return { direction: "flat" as const, percent: null };
  const first = points[0].value;
  const last = points[points.length - 1].value;
  const direction = last > first ? ("up" as const) : last < first ? ("down" as const) : ("flat" as const);
  return { direction, percent: first > 0 ? ((last - first) / first) * 100 : null };
}

/**
 * Average price by day (2px line, end dot) with trade volume as separate bars
 * below — two charts on one time axis, never two y-scales on one plot — or the
 * sell price by minute (K35), placed by time so unseen minutes stay empty, in
 * the same height. Crosshair snaps to readings; arrow keys move between them.
 */
export function MarketChart({
  points: days,
  span,
  label = "일 평균 거래가와 거래량. 화살표 키로 날짜를 이동할 수 있어요.",
}: {
  points: ChartPoint[];
  /** The time window [from, to] in ms when points carry time. */
  span?: [number, number];
  label?: string;
}) {
  const id = useId();
  const [W, setW] = useState(DEFAULT_W);
  const measure = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width > 0) setW(width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const geometry = useMemo(() => {
    const prices = days.map((d) => d.value);
    const ticks = niceTicks(Math.min(...prices), Math.max(...prices), 3);
    const v0 = ticks[0];
    const v1 = ticks.at(-1)!;
    const maxVolume = Math.max(1, ...days.map((d) => d.volume ?? 0));
    const plotW = W - PAD.left - PAD.right;
    const step = days.length > 1 ? plotW / (days.length - 1) : 0;
    const timed = span != null && days.every((d) => d.t != null);
    const x = (i: number) =>
      timed
        ? PAD.left + ((days[i].t! - span![0]) / (span![1] - span![0] || 1)) * plotW
        : PAD.left + (days.length > 1 ? i * step : plotW / 2);
    const y = (v: number) =>
      PAD.top + PRICE_H - ((v - v0) / (v1 - v0 || 1)) * PRICE_H;
    // Bencho's curve (Catmull-Rom through every reading) on our axis: it maps
    // the lowest price to h − pad and the highest to pad, so h and pad are
    // chosen to land those on the tick scale.
    const top = y(Math.max(...prices));
    const bottom = y(Math.min(...prices));
    // By time the readings are not evenly apart: straight segments between
    // them, not the even curve.
    const curved = timed
      ? days.length > 1
        ? { d: days.map((d, i) => `${i ? "L" : "M"}${(x(i) - PAD.left).toFixed(1)} ${y(d.value).toFixed(1)}`).join(" ") }
        : null
      : days.length > 1
        ? curve(prices, plotW, top + bottom, top)
        : null;
    const barW = Math.max(3, Math.min(18, (step || plotW) * 0.55));
    const volumeTop = PAD.top + PRICE_H + GAP;
    const bar = (count: number) => (count / maxVolume) * VOLUME_H;
    return { ticks, x, y, curved, barW, volumeTop, bar, timed };
  }, [days, W, span]);
  // Mouse, touch (sideways drag; a vertical swipe still scrolls) and ← →.
  const { active, svgProps } = useChartScrub({
    count: days.length,
    xOf: geometry.x,
    viewWidth: W,
  });
  if (!days.length) return null;
  const { ticks, x, y, curved, barW, volumeTop, bar, timed } = geometry;
  const last = days.length - 1;
  const shown = active ?? last;
  const priceWidth = Math.max(...days.map((d) => fmt(d.value).length + 1));
  const { direction } = periodChange(days);

  return (
    <figure className={styles.chart} ref={measure}>
      <div className={styles.plot}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={styles.chartSvg}
          role="img"
          data-direction={direction}
          data-scrub={active != null || undefined}
          aria-label={label}
          aria-describedby={`${id}-readout`}
          {...svgProps}
          // A fixed height: the first render guesses the width (DEFAULT_W) and
          // the real one arrives a frame later; with height: auto the chart
          // grew with it and pushed the 14-day table down (CLS 0.016 at 360,
          // PM-프론트 10-12 A6). The drawing is fitted inside meanwhile.
          style={{ ...svgProps.style, height: H }}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                className={styles.grid}
              />
              <text
                x={W - PAD.right + 6}
                y={y(tick)}
                className={styles.tick}
                dominantBaseline="middle"
              >
                {fmt(tick)}
              </text>
            </g>
          ))}
          {/* Bencho's line: one curve, nothing under or around it (its note: a
            wash makes the line the edge of a shape). Red when the window
            rose, blue when it fell, as Korean market screens do. Draws itself
            on every entry (CSS .k-draw; user rule 10-10). */}
          {curved && (
            <path
              d={curved.d}
              transform={`translate(${PAD.left} 0)`}
              className={`${styles.line} k-draw`}
              pathLength={1}
            />
          )}
          {days.map((d, i) =>
            d.volume == null ? null : (
              <rect
                key={d.key}
                x={x(i) - barW / 2}
                y={volumeTop + VOLUME_H - bar(d.volume)}
                width={barW}
                height={Math.max(1, bar(d.volume))}
                rx={2}
                className={`${styles.volume} k-grow`}
                data-active={i === shown || undefined}
                // Grows from the base on every entry; later bars start later but all
                // finish with the line, within --duration-draw (PM #253).
                style={{
                  transitionDelay: `${Math.min(i, 8) * 30}ms`,
                  transitionDuration: `${600 - Math.min(i, 8) * 30}ms`,
                }}
              />
            ),
          )}
          {/* By minute a sparse item has few readings: each one marked. */}
          {timed &&
            days.length <= 20 &&
            days.map((d, i) => <circle key={d.key} cx={x(i)} cy={y(d.value)} r={2.5} className={styles.reading} />)}
          <text x={PAD.left} y={H - 4} className={styles.tick}>
            {timed && span ? minuteLabel(new Date(span[0]).toISOString()) : days[0].axis}
          </text>
          <text
            x={W - PAD.right}
            y={H - 4}
            className={styles.tick}
            textAnchor="end"
          >
            {timed && span ? minuteLabel(new Date(span[1]).toISOString()) : days[last].axis}
          </text>
          {active != null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={volumeTop + VOLUME_H}
              className={styles.crosshair}
              aria-hidden="true"
            />
          )}
          <circle
            cx={x(shown)}
            cy={y(days[shown].value)}
            r={4.5}
            className={styles.dot}
          />
        </svg>
        {/* The reading next to the point while scrubbing; the line below
          (a polite live region) is what a screen reader hears. */}
        {active != null && (
          <ChartTooltip
            x={x(active)}
            y={y(days[active].value) - 8}
            boxWidth={W}
          >
            <strong>{fmt(days[active].value)}G</strong> · {days[active].axis}
          </ChartTooltip>
        )}
      </div>
      <p id={`${id}-readout`} className={styles.readout} aria-live="polite">
        {/* As wide as the longest price, so the date after it stays put while
            scrubbing (PM-프론트 #591: the G moved, a 0.0001 shift at 360). */}
        <strong style={{ minWidth: `${priceWidth}ch` }}>
          {fmt(days[shown].value)}G
        </strong>
        {days[shown].detail}
      </p>
    </figure>
  );
}
