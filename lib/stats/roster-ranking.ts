// Roster ranking (backend #298): rosters LOAKraken has observed, ranked by
// the top six characters' average or sum (or every character's average) of
// combat power or item level. Off on the backend until the screen ships; the
// screen follows ROSTER_RANKING (lib/tools/flags.ts) the same way.

import type { components } from "../api/roster-ranking-schema";

type Schemas = components["schemas"];
export type RosterRankingEnvelope = Schemas["ApiResponseRosterRankingResponse"];
export type RosterRanking = Schemas["RosterRankingResponse"];
export type RosterRow = Schemas["RosterRankingRowResponse"];

export const ROSTER_BASES = [
  { id: "COMBAT_POWER", label: "전투력" },
  { id: "ITEM_LEVEL", label: "아이템 레벨" },
] as const;
export const ROSTER_AGGREGATES = [
  { id: "TOP6_AVG", label: "식스맨 평균" },
  { id: "TOP6_SUM", label: "상위 6명 합" },
  { id: "ALL_AVG", label: "전체 평균" },
] as const;
export type RosterBasis = (typeof ROSTER_BASES)[number]["id"];
export type RosterAggregate = (typeof ROSTER_AGGREGATES)[number]["id"];
export type RosterQuery = { basis: RosterBasis; aggregate: RosterAggregate; server?: string; page: number };

export const ROSTER_PAGE_SIZE = 50;
export const ROSTER_MAX_PAGE = 200;
const isBasis = (value: string | null): value is RosterBasis => ROSTER_BASES.some((item) => item.id === value);
const isAggregate = (value: string | null): value is RosterAggregate => ROSTER_AGGREGATES.some((item) => item.id === value);

/** From a shared link; unknown values fall back to the defaults (combat power, top six average). */
export function parseRosterQuery(input: URLSearchParams): RosterQuery {
  const basis = input.get("basis");
  const aggregate = input.get("aggregate");
  const server = input.get("server")?.trim();
  const page = Number(input.get("page") ?? 1);
  return {
    basis: isBasis(basis) ? basis : "COMBAT_POWER",
    aggregate: isAggregate(aggregate) ? aggregate : "TOP6_AVG",
    server: server && server.length <= 16 && /^[\p{L}\p{N}]+$/u.test(server) ? server : undefined,
    page: Number.isInteger(page) && page >= 1 && page <= ROSTER_MAX_PAGE ? page : 1,
  };
}

/** The screen's own parameters (type=roster kept by the page); defaults left out. */
export function rosterSearch(query: RosterQuery) {
  const out = new URLSearchParams({ type: "roster" });
  if (query.basis !== "COMBAT_POWER") out.set("basis", query.basis);
  if (query.aggregate !== "TOP6_AVG") out.set("aggregate", query.aggregate);
  if (query.server) out.set("server", query.server);
  if (query.page > 1) out.set("page", String(query.page));
  return out;
}
