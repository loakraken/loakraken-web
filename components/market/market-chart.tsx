"use client";

import {
  useCallback,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
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
  const [active, setActive] = useState<number | null>(null);
  const geometry = useMemo(() => {
    const prices = days.map((d) => d.averagePrice);
    const ticks = niceTicks(Math.min(...prices), Math.max(...prices), 3);
    const v0 = ticks[0];
    const v1 = ticks.at(-1)!;
    const maxVolume = Math.max(1, ...days.map((d) => d.tradeCount));
    const plotW = W - PAD.left - PAD.right;
    const step = days.length > 1 ? plotW / (days.length - 1) : 0;
    const x = (i: number) => PAD.left + (days.length > 1 ? i * step : plotW / 2);
    const y = (v: number) =>
      PAD.top + PRICE_H - ((v - v0) / (v1 - v0 || 1)) * PRICE_H;
    const line = days
      .map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.averagePrice)}`)
      .join(" ");
    const base = PAD.top + PRICE_H;
    const area = `${line} L${x(days.length - 1)},${base} L${x(0)},${base} Z`;
    const barW = Math.max(3, Math.min(18, (step || plotW) * 0.55));
    const volumeTop = PAD.top + PRICE_H + GAP;
    const bar = (count: number) => (count / maxVolume) * VOLUME_H;
    return { ticks, x, y, line, area, barW, volumeTop, bar };
  }, [days, W]);
  if (!days.length) return null;
  const { ticks, x, y, line, area, barW, volumeTop, bar } = geometry;
  const last = days.length - 1;
  const shown = active ?? last;

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 1; i < days.length; i++)
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setActive(best);
  }
  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = (active ?? last) + (event.key === "ArrowRight" ? 1 : -1);
    setActive(Math.min(last, Math.max(0, next)));
  }

  return (
    <figure className={styles.chart} ref={measure}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.chartSvg}
        role="img"
        aria-label="일 평균 거래가와 거래량. 화살표 키로 날짜를 이동할 수 있어요."
        aria-describedby={`${id}-readout`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
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
        <path d={area} className={styles.area} />
        {/* Draws itself on every entry (CSS .k-draw: first paint included, no
            replay while the same chart updates; user rule 10-10). */}
        <path d={line} className={`${styles.line} k-draw`} pathLength={1} />
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
          r={4}
          className={styles.dot}
        />
      </svg>
      <p id={`${id}-readout`} className={styles.readout} aria-live="polite">
        <strong>{fmt(days[shown].averagePrice)}G</strong>
        {days[shown].date} · 거래량 {days[shown].tradeCount.toLocaleString("ko-KR")}
      </p>
    </figure>
  );
}
