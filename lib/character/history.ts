// Observation history (#66) → step series for small-multiple charts.
// A point is created only when a value changed; lastConfirmedAt extends the
// final value to the most recent time it was re-confirmed.
import type { HistoryPoint } from "./validate";

export type Metric = "itemLevel" | "combatPower" | "expeditionLevel";
export type Step = { t: number; v: number };

export const METRICS: { key: Metric; label: string }[] = [
  { key: "itemLevel", label: "아이템 레벨" },
  { key: "combatPower", label: "전투력" },
  { key: "expeditionLevel", label: "원정대 레벨" },
];

/** Step vertices in time order; null values break nothing — they are skipped. */
export function stepSeries(points: HistoryPoint[], metric: Metric): Step[] {
  const sorted = [...points].sort(
    (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt),
  );
  const known = sorted.filter((point) => point[metric] != null);
  const steps: Step[] = known.map((point) => ({
    t: Date.parse(point.observedAt),
    v: Number(point[metric]),
  }));
  const last = known.at(-1);
  if (last) {
    const confirmed = Date.parse(last.lastConfirmedAt);
    if (confirmed > steps.at(-1)!.t)
      steps.push({ t: confirmed, v: steps.at(-1)!.v });
  }
  return steps;
}

/** Value in effect at time t (step-after interpolation). */
export function valueAt(steps: Step[], t: number) {
  let value: number | null = null;
  for (const step of steps) {
    if (step.t > t) break;
    value = step.v;
  }
  return value;
}

export function change(steps: Step[]) {
  if (steps.length < 2) return null;
  return steps.at(-1)!.v - steps[0].v;
}

/** 3–5 clean ticks covering [min, max] (1, 2, 2.5, 5 × 10^n steps). */
export function niceTicks(min: number, max: number, target = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.01);
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ??
    10 * power;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; ticks.length === 0 || ticks.at(-1)! < max; v += step)
    ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}
