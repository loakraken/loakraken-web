// Title equip share (api #314, checklist L13·K11·L44): of the rosters LOAKraken
// has seen, how many had a public character wearing each title. The official
// profile shows only the worn title, so titles owned but not worn are never
// counted — the screen says "장착", never "보유". Off on the backend until the
// screen ships; the screen follows TITLE_STATS (lib/tools/flags.ts).

import type { components } from "../api/title-equip-schema";

type Schemas = components["schemas"];
export type TitleEquipEnvelope = Schemas["ApiResponseTitleEquipResponse"];
export type TitleEquip = Schemas["TitleEquipResponse"];
export type EquippedTitle = Schemas["EquippedTitleResponse"];

/** `date`: one stored day (KST); the api keeps days per server and for 30 days only, so the days filter goes with it. */
export type TitleEquipQuery = { server?: string; activeDays?: 7 | 30 | 90; date?: string };
export type TitleSnapshotDatesEnvelope = Schemas["ApiResponseTitleSnapshotDatesResponse"];

const SERVER = /^[\p{L}\p{N}]+$/u;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** From the stats screen's own filters: only server and days apply here; a stored day keeps the server and drops the days (30 only). */
export function titleEquipQuery(input: { server?: string; activeDays?: number; date?: string | null }): TitleEquipQuery {
  const date = input.date && DAY.test(input.date) ? input.date : undefined;
  const server = input.server?.trim();
  const days = input.activeDays;
  return {
    server: server && server.length <= 16 && SERVER.test(server) ? server : undefined,
    activeDays: !date && (days === 7 || days === 30 || days === 90) ? days : undefined,
    ...(date && { date }),
  };
}

export function titleEquipSearch(query: TitleEquipQuery) {
  const out = new URLSearchParams();
  if (query.server) out.set("server", query.server);
  if (query.activeDays) out.set("activeDays", String(query.activeDays));
  if (query.date) out.set("date", query.date);
  return out;
}

export type TitleGroup = { title: string; row: EquippedTitle | null; children: EquippedTitle[] };

/**
 * Titles with their variants (첫 주 클리어 …) under them, in the api's order.
 * A variant whose parent nobody wears still sits under its parent's name
 * (`row` null), after the titles that have a row.
 */
export function groupTitles(rows: readonly EquippedTitle[]): TitleGroup[] {
  const children = new Map<string, EquippedTitle[]>();
  for (const row of rows)
    if (row.parentTitle) children.set(row.parentTitle, [...(children.get(row.parentTitle) ?? []), row]);
  const groups: TitleGroup[] = rows
    .filter((row) => !row.parentTitle)
    .map((row) => ({ title: row.title, row, children: children.get(row.title) ?? [] }));
  const named = new Set(groups.map((group) => group.title));
  for (const [parent, list] of children)
    if (!named.has(parent)) groups.push({ title: parent, row: null, children: list });
  return groups;
}

/** A change between two days in percentage points ("+1.20%p"), "-" when either side is missing. */
export function shareChange(now: number | null | undefined, then: number | null | undefined) {
  if (now == null || then == null) return "-";
  const diff = Math.round((now - then) * 100) / 100;
  return `${diff > 0 ? "+" : diff < 0 ? "−" : "±"}${Math.abs(diff).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%p`;
}

/** "32.26%" of the rosters seen; a share the backend could not give reads "-". */
export const equipShare = (title: EquippedTitle) =>
  title.equippedPercent == null ? "-" : `${title.equippedPercent.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`;
