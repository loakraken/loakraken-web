// 전체 인구 (stats B5, api #788): every character LOAKraken has stored with an
// item level — no filters, the stop list left out — counted by server, class
// and 10-level item level bucket in a weekly snapshot. Characters under 1640
// come from roster lists (no combat power or role), so they only show in
// 레벨별. snapshotDate is null until the first snapshot.
// Validation and the request live in population.backend.ts (server only).
import type { components } from "../api/stats-population-schema";

type Schemas = components["schemas"];
export type PopulationEnvelope = Schemas["ApiResponseStatsPopulationResponse"];
export type Population = Schemas["StatsPopulationResponse"];
export type PopulationCount = Schemas["StatsPopulationCountResponse"];

const SERVER = /^[\p{L}\p{N}]{1,32}$/u;
/** The one filter this view takes: a server name, or none for every server. */
export function populationSearch(server?: string | null) {
  const search = new URLSearchParams();
  if (server && SERVER.test(server)) search.set("server", server);
  return search;
}

/** '2026년 10월 31일' for the 집계 기준 caption (the date is already KST). */
export function snapshotText(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return y && m && d ? `${y}년 ${m}월 ${d}일` : date;
}
