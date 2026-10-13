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

const compile = <T>(ref: string) =>
  lazyValidator(() =>
    new Ajv2020({ strict: false, validateFormats: false }).compile<T>({
      $ref: `#/components/schemas/${ref}`,
      components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
    }),
  );
const validateBoard = compile<GemBoardEnvelope>("ApiResponseAuctionGemBoardResponse");
const validateListings = compile<GemListingsEnvelope>("ApiResponseAuctionListingsResponse");
export const isGemBoardEnvelope = (value: unknown): value is GemBoardEnvelope =>
  validateBoard(value) && value.code === "AUCTION_GEMS_SUCCESS";
export const isGemListingsEnvelope = (value: unknown): value is GemListingsEnvelope =>
  validateListings(value) && value.code === "AUCTION_LISTINGS_SUCCESS";

export const GEM_KINDS = ["겁화", "작열"] as const;
export type GemKind = (typeof GEM_KINDS)[number];
export const GEM_LEVELS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
export const GEM_LISTING_MAX_PAGE = 10;

export type GemPick = { kind: GemKind; level: number; page: number };

/** A cell from a shared link (?kind=겁화&level=10&page=2); anything else is no pick. */
export function parseGemPick(input: URLSearchParams): GemPick | null {
  const kind = input.get("kind");
  const level = Number(input.get("level"));
  const page = Number(input.get("page") ?? 1);
  if (!GEM_KINDS.includes(kind as GemKind) || !Number.isInteger(level) || level < 1 || level > 10) return null;
  return {
    kind: kind as GemKind,
    level,
    page: Number.isInteger(page) && page >= 1 && page <= GEM_LISTING_MAX_PAGE ? page : 1,
  };
}

export function gemPickSearch(pick: GemPick) {
  const out = new URLSearchParams({ kind: pick.kind, level: String(pick.level) });
  if (pick.page > 1) out.set("page", String(pick.page));
  return out;
}

/** Board cells by kind and level (missing ones stay undefined: a blank cell). */
export function gemGrid(board: GemBoard) {
  const grid = new Map<string, GemCell>();
  for (const cell of board.cells) grid.set(`${cell.kind}-${cell.level}`, cell);
  return (kind: GemKind, level: number) => grid.get(`${kind}-${level}`);
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "INVALID_AUCTION_LEVELS"],
  429: ["LOST_ARK_RATE_LIMITED", "CLIENT_RATE_LIMITED"],
  502: ["LOST_ARK_API_ERROR"],
  503: ["LOST_ARK_NOT_CONFIGURED"],
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
  if (url) for (const [key, value] of gemPickSearch(pick)) url.searchParams.set(key, value);
  if (url && pick.page === 1) url.searchParams.set("page", "1");
  return requestBackend(url, { ...options, isValid: isGemListingsEnvelope, errorCodes });
}

/** The skill a gem works on, from its options ("[바드] …" class + effect name). */
export function gemTarget(listing: GemListing) {
  const option = listing.options.find((o) => o.className);
  return option ? `${option.className} · ${option.name}` : null;
}
