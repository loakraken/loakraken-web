// T4 gem prices on the auction house (api #139, API list #8·#9): the lowest
// buy-now price, listing count and change from yesterday for 겁화·작열 levels
// 1~10, and the cheapest listings of one cell. The board is cached by the
// backend; a listings page costs at most one official call (1-minute cache).

import type { components } from "../api/auction-gems-schema";

type Schemas = components["schemas"];
export type GemBoardEnvelope = Schemas["ApiResponseAuctionGemBoardResponse"];
export type GemBoard = Schemas["AuctionGemBoardResponse"];
export type GemCell = Schemas["AuctionGemCellResponse"];
export type GemListingsEnvelope = Schemas["ApiResponseAuctionListingsResponse"];
export type GemListing = Schemas["AuctionListingResponse"];
export type GemSkillsEnvelope = Schemas["ApiResponseAuctionGemSkillsResponse"];
export type GemClass = Schemas["AuctionGemClassResponse"];
export type GemSkill = Schemas["AuctionGemSkillResponse"];

export const GEM_KINDS = ["겁화", "작열"] as const;
export type GemKind = (typeof GEM_KINDS)[number];
export const GEM_LEVELS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
export const GEM_LISTING_MAX_PAGE = 10;
const MAX_INT32 = 2_147_483_647;

/**
 * A board cell, and optionally the class and skill its listings are narrowed
 * to (api #542: a skill needs its class; the cell prices stay unfiltered).
 */
export type GemPick = { kind: GemKind; level: number; page: number; className?: string | null; skill?: number | null };

/** A cell from a shared link (?kind=겁화&level=10&page=2&class=바드&skill=21170); anything else is no pick. */
export function parseGemPick(input: URLSearchParams): GemPick | null {
  const kind = input.get("kind");
  const level = Number(input.get("level"));
  const page = Number(input.get("page") ?? 1);
  if (!GEM_KINDS.includes(kind as GemKind) || !Number.isInteger(level) || level < 1 || level > 10) return null;
  const className = input.get("class")?.trim() || null;
  const skill = Number(input.get("skill"));
  const narrowed = className && className.length <= 20 ? className : null;
  return {
    kind: kind as GemKind,
    level,
    page: Number.isInteger(page) && page >= 1 && page <= GEM_LISTING_MAX_PAGE ? page : 1,
    className: narrowed,
    // A skill means nothing without its class; codes are int32 on the backend.
    skill: narrowed && Number.isInteger(skill) && skill >= 1 && skill <= MAX_INT32 ? skill : null,
  };
}

export function gemPickSearch(pick: GemPick) {
  const out = new URLSearchParams({ kind: pick.kind, level: String(pick.level) });
  if (pick.page > 1) out.set("page", String(pick.page));
  if (pick.className) {
    out.set("class", pick.className);
    if (pick.skill) out.set("skill", String(pick.skill));
  }
  return out;
}

/**
 * The pick to ask for instead after a failed listings request: with the class
 * filter switched off (404 GEM_FILTER_DISABLED), a shared address that still
 * names a class or skill asks again for the same cell without them. null when
 * there is nothing to drop or the failure is another one.
 */
export function pickAfterFailure(pick: GemPick, code: string | undefined): GemPick | null {
  if (code !== "GEM_FILTER_DISABLED" || (!pick.className && !pick.skill)) return null;
  return { kind: pick.kind, level: pick.level, page: 1, className: null, skill: null };
}

/** The skills of a class that can narrow listings of this kind (some only 겁화 or only 작열). */
export const skillsFor = (classes: readonly GemClass[], className: string | null | undefined, kind: GemKind) =>
  (classes.find((c) => c.className === className)?.skills ?? []).filter((s) => s.kinds.includes(kind));

/** Board cells by kind and level (missing ones stay undefined: a blank cell). */
export function gemGrid(board: GemBoard) {
  const grid = new Map<string, GemCell>();
  for (const cell of board.cells) grid.set(`${cell.kind}-${cell.level}`, cell);
  return (kind: GemKind, level: number) => grid.get(`${kind}-${level}`);
}

/**
 * A cell whose fresh value ran out shows the last one seen (api #690:
 * READY with `stale` and its own observedAt). Optional until that api ships:
 * a cell without it is current.
 */
export const isStale = (cell: GemCell) =>
  (cell as GemCell & { stale?: boolean | null }).stale === true && cell.observedAt != null;

const kstDay = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric" });
const kstTime = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const kstDate = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" });

/**
 * When a stale value was seen: its time on the board's own day ("23:59"),
 * else its date ("10. 24."). The board's day is its newest current cell's,
 * so the words never depend on the viewer's clock (same on server and client).
 */
export function staleWhen(cell: GemCell, board: GemBoard) {
  const seen = new Date(cell.observedAt!);
  const current = board.cells
    .filter((c) => c.status === "READY" && !isStale(c) && c.observedAt)
    .map((c) => Date.parse(c.observedAt!));
  const latest = current.length ? new Date(Math.max(...current)) : seen;
  return kstDay.format(seen) === kstDay.format(latest) ? kstTime.format(seen) : kstDate.format(seen);
}

export type Options = { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number };

/** The skill a gem works on, from its options ("[바드] …" class + effect name). */
export function gemTarget(listing: GemListing) {
  const option = listing.options.find((o) => o.className);
  return option ? `${option.className} · ${option.name}` : null;
}
