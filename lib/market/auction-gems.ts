// T4 gem prices on the auction house (api #139, API list #8·#9): the lowest
// buy-now price, listing count and change from yesterday for 겁화·작열 levels
// 1~10, and the cheapest listings of one cell. The board is cached by the
// backend; a listings page costs at most one official call (1-minute cache).
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/auction-gems.openapi.json";
import type { components } from "../api/auction-gems-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type GemBoardEnvelope = Schemas["ApiResponseAuctionGemBoardResponse"];
export type GemBoard = Schemas["AuctionGemBoardResponse"];
export type GemCell = Schemas["AuctionGemCellResponse"];
export type GemListingsEnvelope = Schemas["ApiResponseAuctionListingsResponse"];
export type GemListing = Schemas["AuctionListingResponse"];
export type GemSkillsEnvelope = Schemas["ApiResponseAuctionGemSkillsResponse"];
export type GemClass = Schemas["AuctionGemClassResponse"];
export type GemSkill = Schemas["AuctionGemSkillResponse"];

// `filter` (api #548) is required in the contract, but a backend from before
// it answers without one: optional here until that backend is gone, so the
// plain listings keep working whichever ships first. The screen never reads it.
const schemas = (() => {
  const all = tolerantSchemas(contract.components.schemas);
  const listings = all.AuctionListingsResponse;
  return {
    ...all,
    AuctionListingsResponse: { ...listings, required: listings.required.filter((key) => key !== "filter") },
  };
})();
const compile = <T>(ref: string) =>
  lazyValidator(() =>
    new Ajv2020({ strict: false, validateFormats: false }).compile<T>({
      $ref: `#/components/schemas/${ref}`,
      components: { ...contract.components, schemas },
    }),
  );
const validateBoard = compile<GemBoardEnvelope>("ApiResponseAuctionGemBoardResponse");
const validateListings = compile<GemListingsEnvelope>("ApiResponseAuctionListingsResponse");
const validateSkills = compile<GemSkillsEnvelope>("ApiResponseAuctionGemSkillsResponse");
export const isGemSkillsEnvelope = (value: unknown): value is GemSkillsEnvelope =>
  validateSkills(value) && value.code === "AUCTION_GEM_SKILLS_SUCCESS";
export const isGemBoardEnvelope = (value: unknown): value is GemBoardEnvelope =>
  validateBoard(value) && value.code === "AUCTION_GEMS_SUCCESS";
export const isGemListingsEnvelope = (value: unknown): value is GemListingsEnvelope =>
  validateListings(value) && value.code === "AUCTION_LISTINGS_SUCCESS";

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

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "INVALID_AUCTION_LEVELS", "INVALID_GEM_FILTER"],
  // The class/skill filter is switched off: the screen hides it.
  404: ["GEM_FILTER_DISABLED"],
  429: ["LOST_ARK_RATE_LIMITED", "CLIENT_RATE_LIMITED"],
  502: ["LOST_ARK_API_ERROR"],
  // MARKET_SEARCH_BUSY: the filter's share of searches is used up (Retry-After).
  503: ["LOST_ARK_NOT_CONFIGURED", "MARKET_SEARCH_BUSY"],
  504: ["LOST_ARK_API_TIMEOUT"],
};
type Options = { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number };

export function requestGemBoard(origin: string | undefined, options: Options = {}): Promise<BackendResult<GemBoardEnvelope>> {
  const url = backendUrl(origin, "/api/v1/markets/auctions/gems");
  return requestBackend(url, { ...options, isValid: isGemBoardEnvelope, errorCodes });
}

export function requestGemListings(
  pick: GemPick,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<GemListingsEnvelope>> {
  const url = backendUrl(origin, "/api/v1/markets/auctions/gems/listings");
  if (url) {
    url.searchParams.set("kind", pick.kind);
    url.searchParams.set("level", String(pick.level));
    url.searchParams.set("page", String(pick.page));
    if (pick.className) {
      url.searchParams.set("className", pick.className);
      if (pick.skill) url.searchParams.set("skill", String(pick.skill));
    }
  }
  return requestBackend(url, { ...options, isValid: isGemListingsEnvelope, errorCodes });
}

/** The classes and gem skills listings can be narrowed to (no official call). */
export function requestGemSkills(origin: string | undefined, options: Options = {}): Promise<BackendResult<GemSkillsEnvelope>> {
  const url = backendUrl(origin, "/api/v1/markets/auctions/gems/skills");
  return requestBackend(url, { ...options, isValid: isGemSkillsEnvelope, errorCodes });
}

/** The skill a gem works on, from its options ("[바드] …" class + effect name). */
export function gemTarget(listing: GemListing) {
  const option = listing.options.find((o) => o.className);
  return option ? `${option.className} · ${option.name}` : null;
}
