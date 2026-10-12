"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { curve } from "@/components/ui/bencho/balance-curve";
import { ChartTooltip, useChartScrub } from "@/components/ui/chart-scrub";
import { niceTicks } from "@/lib/character/history";
import type { DailyStat } from "@/lib/market/board";
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
 * Daily average price (2px line, light wash, end dot) with trade volume as
 * separate bars below — two charts on one time axis, never two y-scales on
 * one plot. Crosshair snaps to days; arrow keys move between them.
 */
export function MarketChart({ days }: { days: DailyStat[] }) {
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
    const prices = days.map((d) => d.averagePrice);
    const ticks = niceTicks(Math.min(...prices), Math.max(...prices), 3);
    const v0 = ticks[0];
    const v1 = ticks.at(-1)!;
    const maxVolume = Math.max(1, ...days.map((d) => d.tradeCount));
    const plotW = W - PAD.left - PAD.right;
    const step = days.length > 1 ? plotW / (days.length - 1) : 0;
    const x = (i: number) =>
      PAD.left + (days.length > 1 ? i * step : plotW / 2);
    const y = (v: number) =>
      PAD.top + PRICE_H - ((v - v0) / (v1 - v0 || 1)) * PRICE_H;
    // Bencho's curve (Catmull-Rom through every reading) on our axis: it maps
    // the lowest price to h − pad and the highest to pad, so h and pad are
    // chosen to land those on the tick scale.
    const top = y(Math.max(...prices));
    const bottom = y(Math.min(...prices));
    const curved =
      days.length > 1 ? curve(prices, plotW, top + bottom, top) : null;
    const barW = Math.max(3, Math.min(18, (step || plotW) * 0.55));
    const volumeTop = PAD.top + PRICE_H + GAP;
    const bar = (count: number) => (count / maxVolume) * VOLUME_H;
    return { ticks, x, y, curved, barW, volumeTop, bar };
  }, [days, W]);
  // Mouse, touch (sideways drag; a vertical swipe still scrolls) and ← →.
  const { active, svgProps } = useChartScrub({
    count: days.length,
    xOf: geometry.x,
    viewWidth: W,
  });
  if (!days.length) return null;
  const { ticks, x, y, curved, barW, volumeTop, bar } = geometry;
  const last = days.length - 1;
  const shown = active ?? last;
  const priceWidth = Math.max(...days.map((d) => fmt(d.averagePrice).length + 1));
  const direction =
    days[last].averagePrice > days[0].averagePrice
      ? "up"
      : days[last].averagePrice < days[0].averagePrice
        ? "down"
        : "flat";

  return (
    <figure className={styles.chart} ref={measure}>
      <div className={styles.plot}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={styles.chartSvg}
          role="img"
          data-direction={direction}
          data-scrub={active != null || undefined}
          aria-label="일 평균 거래가와 거래량. 화살표 키로 날짜를 이동할 수 있어요."
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
          {days.map((d, i) => (
            <rect
              key={d.date}
              x={x(i) - barW / 2}
              y={volumeTop + VOLUME_H - bar(d.tradeCount)}
              width={barW}
              height={Math.max(1, bar(d.tradeCount))}
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
          ))}
          <text x={PAD.left} y={H - 4} className={styles.tick}>
            {short(days[0].date)}
          </text>
          <text
            x={W - PAD.right}
            y={H - 4}
            className={styles.tick}
            textAnchor="end"
          >
            {short(days[last].date)}
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
            cy={y(days[shown].averagePrice)}
            r={4.5}
            className={styles.dot}
          />
        </svg>
        {/* The reading next to the point while scrubbing; the line below
          (a polite live region) is what a screen reader hears. */}
        {active != null && (
          <ChartTooltip
            x={x(active)}
            y={y(days[active].averagePrice) - 8}
            boxWidth={W}
          >
            <strong>{fmt(days[active].averagePrice)}G</strong> ·{" "}
            {short(days[active].date)}
          </ChartTooltip>
        )}
      </div>
      <p id={`${id}-readout`} className={styles.readout} aria-live="polite">
        {/* As wide as the longest price, so the date after it stays put while
            scrubbing (PM-프론트 #591: the G moved, a 0.0001 shift at 360). */}
        <strong style={{ minWidth: `${priceWidth}ch` }}>
          {fmt(days[shown].averagePrice)}G
        </strong>
        {days[shown].date} · 거래량{" "}
        {days[shown].tradeCount.toLocaleString("ko-KR")}
      </p>
    </figure>
  );
}
