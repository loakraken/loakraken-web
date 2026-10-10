// Character views (F-8) laid out as a week-column heatmap: columns are weeks
// (Sunday first), rows are weekdays, oldest week on the left.
import type { DailyViews } from "./validate";

export type ViewCell = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };
export type ViewWeek = (ViewCell | null)[];

const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const month = (date: string) => Number(date.slice(5, 7));

/** 0 for no views, otherwise 1–4 relative to the busiest day in range. */
export function viewLevel(count: number, max: number): ViewCell["level"] {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as ViewCell["level"];
}

export function viewWeeks(days: DailyViews[]): ViewWeek[] {
  if (!days.length) return [];
  const max = Math.max(...days.map((d) => d.count));
  const weeks: ViewWeek[] = [];
  let week: ViewWeek = Array.from({ length: weekday(days[0].date) }, () => null);
  for (const day of days) {
    week.push({ date: day.date, count: day.count, level: viewLevel(day.count, max) });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) weeks.push([...week, ...Array.from({ length: 7 - week.length }, () => null)]);
  return weeks;
}

/** Month labels by column: shown where a new month starts, never two within 3 columns. */
export function monthLabels(weeks: ViewWeek[]) {
  const labels: { column: number; text: string }[] = [];
  let previous = 0;
  weeks.forEach((week, column) => {
    const first = week.find((cell) => cell !== null);
    if (!first) return;
    const starts = week.find((cell) => cell && cell.date.endsWith("-01"));
    const value = column === 0 ? month(first.date) : starts ? month(starts.date) : previous;
    if (value === previous) return;
    if (labels.length && column - labels.at(-1)!.column < 3) labels.pop();
    labels.push({ column, text: `${value}월` });
    previous = value;
  });
  return labels;
}

export function viewDateLabel(date: string) {
  return `${month(date)}월 ${Number(date.slice(8, 10))}일`;
}
