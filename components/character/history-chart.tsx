"use client";

import {
  useCallback,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { niceTicks, valueAt, type Step } from "@/lib/character/history";
import styles from "./history-chart.module.css";

const DEFAULT_W = 560;
const H = 180;
const PAD = { top: 12, right: 16, bottom: 26, left: 52 };
const fmt = (v: number) =>
  v.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
const day = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
});
const stamp = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Single-series step chart: 2px line, 10% wash, end dot, crosshair + tooltip. */
export function HistoryChart({
  label,
  steps,
}: {
  label: string;
  steps: Step[];
}) {
  const id = useId();
  // Draw at the real width so axis text keeps its intended size.
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
  const [hover, setHover] = useState<number | null>(null);
  const geometry = useMemo(() => {
    const t0 = steps[0].t;
    const t1 = Math.max(steps.at(-1)!.t, t0 + 60_000);
    const values = steps.map((s) => s.v);
    const ticks = niceTicks(Math.min(...values), Math.max(...values));
    const v0 = ticks[0];
    const v1 = ticks.at(-1)!;
    const x = (t: number) =>
      PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
    const y = (v: number) =>
      H - PAD.bottom - ((v - v0) / (v1 - v0 || 1)) * (H - PAD.top - PAD.bottom);
    let line = `M${x(steps[0].t)},${y(steps[0].v)}`;
    for (let i = 1; i < steps.length; i++)
      line += ` H${x(steps[i].t)} V${y(steps[i].v)}`;
    const base = H - PAD.bottom;
    const area = `${line} V${base} H${x(steps[0].t)} Z`;
    return { t0, t1, ticks, x, y, line, area };
  }, [steps, W]);
  const { t0, t1, ticks, x, y, line, area } = geometry;
  const last = steps.at(-1)!;
  // Crosshair snaps to observation times so readers land on real data.
  const stops = steps.map((s) => s.t);
  const active = hover ?? null;
  const activeValue = active != null ? valueAt(steps, active) : null;

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * W;
    const t = t0 + ((px - PAD.left) / (W - PAD.left - PAD.right)) * (t1 - t0);
    const nearest = stops.reduce(
      (best, s) => (Math.abs(s - t) < Math.abs(best - t) ? s : best),
      stops[0],
    );
    setHover(nearest);
  }
  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const index = hover == null ? stops.length - 1 : stops.indexOf(hover);
    const next = Math.min(
      stops.length - 1,
      Math.max(0, index + (event.key === "ArrowRight" ? 1 : -1)),
    );
    setHover(stops[next]);
  }

  return (
    <figure className={styles.figure} ref={measure}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.svg}
        role="img"
        aria-label={`${label} 변화 그래프. 화살표 키로 기록 시점을 이동할 수 있어요.`}
        aria-describedby={`${id}-readout`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
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
              x={PAD.left - 8}
              y={y(tick)}
              className={styles.tick}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {fmt(tick)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 6} className={styles.tick}>
          {day.format(t0)}
        </text>
        <text
          x={W - PAD.right}
          y={H - 6}
          className={styles.tick}
          textAnchor="end"
        >
          {day.format(t1)}
        </text>
        <path d={area} className={styles.area} />
        <path d={line} className={styles.line} pathLength={1} data-draw />
        <circle cx={x(last.t)} cy={y(last.v)} r={4} className={styles.dot} />
        {active != null && activeValue != null && (
          <g aria-hidden="true">
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              className={styles.crosshair}
            />
            <circle
              cx={x(active)}
              cy={y(activeValue)}
              r={4}
              className={styles.dot}
            />
          </g>
        )}
      </svg>
      <p id={`${id}-readout`} className={styles.readout} aria-live="polite">
        {active != null && activeValue != null ? (
          <>
            <strong>{fmt(activeValue)}</strong> {stamp.format(active)}
          </>
        ) : (
          <>
            <strong>{fmt(last.v)}</strong> 최근 확인 {stamp.format(last.t)}
          </>
        )}
      </p>
    </figure>
  );
}
