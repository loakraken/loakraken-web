// The dedicated schedule page (/schedule): ILOA /calendar categories and the
// 로아랩 /calendars per-category view over the home schedule response.

import { nextReset } from "../tools/homework";
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

export type ScheduleGroup = {
  /** Stable key: the slug, or `other:<category>` for a category this build does not route. */
  key: string;
  label: string;
  slug: ScheduleCategory | null;
  items: (Island | Timed | Other)[];
};

/**
 * The day's schedule as page sections: the three fixed lists, then `others`
 * split by their official category (known ones in page order, new ones after
 * them by name so they still show under "전체").
 */
export function scheduleGroups(data: Schedule): ScheduleGroup[] {
  const groups: ScheduleGroup[] = [
    { key: "adventure-island", label: "모험 섬", slug: "adventure-island", items: data.adventureIslands },
    { key: "chaos-gate", label: "카오스게이트", slug: "chaos-gate", items: data.chaosGates },
    { key: "field-boss", label: "필드 보스", slug: "field-boss", items: data.fieldBosses },
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

/** "3일 11시간" / "5시간 20분" until the next weekly reset (Wednesday 06:00 KST). */
export function resetLeft(now: number) {
  const minutes = Math.max(0, Math.floor((nextReset(now) - now) / 60_000));
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return d > 0 ? `${d}일 ${h}시간` : `${h}시간 ${m}분`;
}
