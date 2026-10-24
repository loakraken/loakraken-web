// The dedicated schedule page (/schedule): categories and a per-category
// view over the home schedule response.

import { nextReset } from "../tools/homework";
import { remainingText } from "../time/remaining";
import { sectionStatus, type Island, type Other, type Schedule, type Timed } from "./model";

/** Category routes, in the page order. "섬"·"태초의 섬"·"항해"·"로웬" are the
 *  official calendar's CategoryName values the backend passes through as
 *  `others[].category`. */
export const SCHEDULE_CATEGORIES = [
  { slug: "adventure-island", label: "모험 섬" },
  { slug: "chaos-gate", label: "카오스게이트" },
  { slug: "field-boss", label: "필드 보스" },
  { slug: "origin-island", label: "태초의 섬" },
  { slug: "island", label: "섬" },
  { slug: "sailing", label: "항해" },
  { slug: "rowen", label: "로웬" },
] as const;

export type ScheduleCategory = (typeof SCHEDULE_CATEGORIES)[number]["slug"];

export const isScheduleCategory = (value: string): value is ScheduleCategory =>
  SCHEDULE_CATEGORIES.some((category) => category.slug === value);

export const categoryLabel = (slug: ScheduleCategory) =>
  SCHEDULE_CATEGORIES.find((category) => category.slug === slug)!.label;

export const schedulePath = (slug: ScheduleCategory | null) =>
  slug ? `/schedule/${slug}` : "/schedule";

/** The category in a /schedule path, null for the whole schedule (or an unknown one). */
export function categoryOfPath(pathname: string | null): ScheduleCategory | null {
  const slug = pathname?.match(/^\/schedule\/([^/]+)\/?$/)?.[1];
  return slug && isScheduleCategory(slug) ? slug : null;
}

/** A place inside a merged row: its official name and entry level. */
export type Place = { name: string; minItemLevel: number | null };

/** A schedule row; `places` when several official entries were merged into it. */
export type Row = (Island | Timed | Other) & { places?: Place[] };

export type ScheduleGroup = {
  /** Stable key: the slug, or `other:<category>` for a category this build does not route. */
  key: string;
  label: string;
  slug: ScheduleCategory | null;
  items: Row[];
};

/**
 * Chaos gates and field bosses come one official entry per place (13 chaos
 * gates with the same rounds and rewards). Entries with the same rounds and
 * rewards become one row named by the category, listing the places; an entry
 * unlike the others stays as it is. Two different merged sets keep apart by
 * their entry level.
 */
export function mergeSameRounds(items: Timed[], label: string): Row[] {
  const sets = new Map<string, Timed[]>();
  for (const item of items) {
    const key = JSON.stringify([item.startTimes, item.rewardGroups]);
    const set = sets.get(key);
    if (set) set.push(item);
    else sets.set(key, [item]);
  }
  const merged = [...sets.values()].filter((set) => set.length > 1);
  return [...sets.values()].map((set): Row => {
    if (set.length === 1) return set[0];
    const levels = set.map((item) => item.minItemLevel).filter((level): level is number => level != null);
    const minItemLevel = levels.length ? Math.min(...levels) : null;
    return {
      ...set[0],
      name:
        merged.length > 1 && minItemLevel != null ? `${label} ${minItemLevel.toLocaleString("ko-KR")} 이상` : label,
      minItemLevel,
      places: set.map((item) => ({ name: item.name, minItemLevel: item.minItemLevel })),
    };
  });
}

/**
 * The entries that run on the day asked for. The official week lists every
 * chaos gate and field boss of the week, with no rounds (`startTimes: []`) on
 * the days it is not open, so "listed" is not "open today".
 */
export const running = <T extends { startTimes: readonly string[] }>(items: readonly T[]) =>
  items.filter((item) => item.startTimes.length > 0);

/** Chaos gate and field boss days (the date line and the week strip dots); `on` when it has a round that day. */
export const dayKinds = (data: Pick<Schedule, "chaosGates" | "fieldBosses">) => [
  { key: "chaos-gate", label: "카오스게이트", on: running(data.chaosGates).length > 0 },
  { key: "field-boss", label: "필드 보스", on: running(data.fieldBosses).length > 0 },
];

/**
 * The day's schedule as page sections: the three fixed lists, then `others`
 * split by their official category (known ones in page order, new ones after
 * them by name so they still show under "전체").
 */
export function scheduleGroups(data: Schedule): ScheduleGroup[] {
  const groups: ScheduleGroup[] = [
    { key: "adventure-island", label: "모험 섬", slug: "adventure-island", items: data.adventureIslands },
    // Only what runs that day: a day off has no row (the date line says so).
    { key: "chaos-gate", label: "카오스게이트", slug: "chaos-gate", items: mergeSameRounds(running(data.chaosGates), "카오스게이트") },
    { key: "field-boss", label: "필드 보스", slug: "field-boss", items: mergeSameRounds(running(data.fieldBosses), "필드 보스") },
  ];
  const byCategory = new Map<string, Other[]>();
  for (const item of data.others) {
    const list = byCategory.get(item.category);
    if (list) list.push(item);
    else byCategory.set(item.category, [item]);
  }
  for (const category of SCHEDULE_CATEGORIES.slice(3)) {
    groups.push({
      key: category.slug,
      label: category.label,
      slug: category.slug,
      items: byCategory.get(category.label) ?? [],
    });
    byCategory.delete(category.label);
  }
  for (const [label, items] of [...byCategory].sort(([a], [b]) => a.localeCompare(b, "ko"))) {
    groups.push({ key: `other:${label}`, label, slug: null, items });
  }
  return groups;
}

/**
 * "다가오는 일정": per group, the next round still ahead today and the names
 * that start then. Groups with nothing left today are left out.
 */
export function upcomingRounds(groups: ScheduleGroup[], now: number) {
  return groups.flatMap((group) => {
    const status = sectionStatus(group.items, now);
    if (status.state !== "upcoming" || !status.next) return [];
    const at = status.next;
    const names = group.items
      .filter((item) => item.startTimes.some((time) => Date.parse(time) === Date.parse(at)))
      .map((item) => item.name);
    return [{ key: group.key, label: group.label, slug: group.slug, at, names }];
  });
}

/** Time left until the next weekly reset (Wednesday 06:00 KST), shared format. */
export function resetLeft(now: number) {
  return remainingText(nextReset(now) - now) ?? "0초";
}
