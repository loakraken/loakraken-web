// Roster titles (backend #123, title-record-v1): every title LOAKraken has seen
// equipped on the same-server roster, in the order it was first seen. Only
// equipped titles are recorded, so this is never the acquisition order.

import type { components } from "../api/titles-schema";

type Schemas = components["schemas"];
export type TitlesEnvelope = Schemas["ApiResponseRosterTitlesResponse"];
export type RosterTitles = Schemas["RosterTitlesResponse"];
// firstObservedDate (backend #176) is optional here: a backend from before it
// (or its cached answer) still returns a valid list, grouped by firstObservedAt.
export type RosterTitle = Omit<Schemas["RosterTitleResponse"], "firstObservedDate"> & {
  firstObservedDate?: string;
};

/** First-seen order (ties keep the backend's order). */
export const byObservedOrder = (titles: RosterTitle[]) =>
  [...titles].sort((a, b) => a.observedOrder - b.observedOrder);

const day = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
/** 2026. 10. 01. → 2026.10.01 (KST). */
export const titleDate = (iso: string) => day.format(new Date(iso)).replace(/\.\s?/g, ".").replace(/\.$/, "");

/**
 * First-seen order folded by KST day (backend #176): titles first seen on the
 * same day came in together (one roster scan), so their order means nothing
 * and they are shown as one "같은 날 확인" group. Uses the backend's
 * firstObservedDate (KST), or the KST date of firstObservedAt if it is malformed.
 */
export function groupByDay(titles: RosterTitle[]) {
  const groups: { day: string; titles: RosterTitle[] }[] = [];
  for (const title of byObservedOrder(titles)) {
    const given = title.firstObservedDate;
    const day = given && /^\d{4}-\d{2}-\d{2}$/.test(given) ? given.replaceAll("-", ".") : titleDate(title.firstObservedAt);
    const last = groups.at(-1);
    if (last && last.day === day) last.titles.push(title);
    else groups.push({ day, titles: [title] });
  }
  return groups;
}
