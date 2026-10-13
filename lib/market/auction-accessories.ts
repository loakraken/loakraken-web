// T4 accessory prices on the auction house (api #139, API list #10 and the
// board it belongs to): for each slot, the lowest buy-now price of every
// grade combination of its key polish effects (상상~하중), and the cheapest
// listings of one combination. Board cached by the backend; a listings page
// costs at most one official call (1-minute cache).
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/auction-accessories.openapi.json";
import type { components } from "../api/auction-accessories-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type AccessoryBoardEnvelope = Schemas["ApiResponseAuctionAccessoryBoardResponse"];
export type AccessoryBoard = Schemas["AuctionAccessoryBoardResponse"];
export type AccessorySlot = Schemas["AuctionAccessorySlotResponse"];
export type AccessoryCell = Schemas["AuctionAccessoryCellResponse"];
export type AccessoryListingsEnvelope = Schemas["ApiResponseAuctionListingsResponse"];
export type AccessoryListing = Schemas["AuctionListingResponse"];

const compile = <T>(ref: string) =>
  lazyValidator(() =>
    new Ajv2020({ strict: false, validateFormats: false }).compile<T>({
      $ref: `#/components/schemas/${ref}`,
      components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
    }),
  );
const validateBoard = compile<AccessoryBoardEnvelope>("ApiResponseAuctionAccessoryBoardResponse");
const validateListings = compile<AccessoryListingsEnvelope>("ApiResponseAuctionListingsResponse");
export const isAccessoryBoardEnvelope = (value: unknown): value is AccessoryBoardEnvelope =>
  validateBoard(value) && value.code === "AUCTION_ACCESSORIES_SUCCESS";
export const isAccessoryListingsEnvelope = (value: unknown): value is AccessoryListingsEnvelope =>
  validateListings(value) && value.code === "AUCTION_LISTINGS_SUCCESS";

export const GRADES = [
  { id: "ANCIENT", label: "고대" },
  { id: "RELIC", label: "유물" },
] as const;
export const ROLES = [
  { id: "DEALER", label: "딜러" },
  { id: "SUPPORT", label: "서포터" },
] as const;
export const QUALITIES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90] as const;
const SLOTS = ["NECKLACE", "EARRING", "RING"] as const;
const LEVELS = ["LOW", "MID", "HIGH"] as const;
export const ACCESSORY_LISTING_MAX_PAGE = 10;

export type Grade = (typeof GRADES)[number]["id"];
export type Role = (typeof ROLES)[number]["id"];
export type Slot = (typeof SLOTS)[number];
export type Level = (typeof LEVELS)[number];
export type AccessoryFilter = { grade: Grade; role: Role; minQuality: number };
export type AccessoryPick = { slot: Slot; levels: Level[]; page: number };

const one = <T extends string>(list: readonly T[], value: string | null, fallback: T) =>
  list.includes(value as T) ? (value as T) : fallback;

/** Filters from a shared link; defaults 고대 · 딜러 · 품질 70 (the backend's). */
export function parseAccessoryFilter(input: URLSearchParams): AccessoryFilter {
  const quality = Number(input.get("minQuality") ?? 70);
  return {
    grade: one(["ANCIENT", "RELIC"] as const, input.get("grade"), "ANCIENT"),
    role: one(["DEALER", "SUPPORT"] as const, input.get("role"), "DEALER"),
    minQuality: (QUALITIES as readonly number[]).includes(quality) ? quality : 70,
  };
}

/** A cell from a shared link (?slot=EARRING&levels=HIGH,MID&page=2); anything else is no pick. */
export function parseAccessoryPick(input: URLSearchParams): AccessoryPick | null {
  const slot = input.get("slot");
  const levels = (input.get("levels") ?? "").split(",").filter(Boolean);
  const page = Number(input.get("page") ?? 1);
  if (!SLOTS.includes(slot as Slot) || levels.length < 1 || levels.length > 2 || !levels.every((l) => LEVELS.includes(l as Level)))
    return null;
  return {
    slot: slot as Slot,
    levels: levels as Level[],
    page: Number.isInteger(page) && page >= 1 && page <= ACCESSORY_LISTING_MAX_PAGE ? page : 1,
  };
}

/** The screen's address: filters off their defaults, then the pick. */
export function accessorySearch(filter: AccessoryFilter, pick: AccessoryPick | null) {
  const out = new URLSearchParams();
  if (filter.grade !== "ANCIENT") out.set("grade", filter.grade);
  if (filter.role !== "DEALER") out.set("role", filter.role);
  if (filter.minQuality !== 70) out.set("minQuality", String(filter.minQuality));
  if (pick) {
    out.set("slot", pick.slot);
    out.set("levels", pick.levels.join(","));
    if (pick.page > 1) out.set("page", String(pick.page));
  }
  return out;
}

const filterParams = (filter: AccessoryFilter) =>
  new URLSearchParams({ grade: filter.grade, role: filter.role, minQuality: String(filter.minQuality) });

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "INVALID_AUCTION_LEVELS"],
  429: ["LOST_ARK_RATE_LIMITED", "CLIENT_RATE_LIMITED"],
  502: ["LOST_ARK_API_ERROR"],
  503: ["LOST_ARK_NOT_CONFIGURED"],
  504: ["LOST_ARK_API_TIMEOUT"],
};
type Options = { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number };

export function requestAccessoryBoard(
  filter: AccessoryFilter,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<AccessoryBoardEnvelope>> {
  const url = backendUrl(origin, "/api/v1/markets/auctions/accessories");
  if (url) for (const [key, value] of filterParams(filter)) url.searchParams.set(key, value);
  return requestBackend(url, { ...options, isValid: isAccessoryBoardEnvelope, errorCodes });
}

export function requestAccessoryListings(
  filter: AccessoryFilter,
  pick: AccessoryPick,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<AccessoryListingsEnvelope>> {
  const url = backendUrl(origin, "/api/v1/markets/auctions/accessories/listings");
  if (url) {
    for (const [key, value] of filterParams(filter)) url.searchParams.set(key, value);
    url.searchParams.set("slot", pick.slot);
    url.searchParams.set("levels", pick.levels.join(","));
    url.searchParams.set("page", String(pick.page));
  }
  return requestBackend(url, { ...options, isValid: isAccessoryListingsEnvelope, errorCodes });
}

const sameLevels = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
export const isPicked = (pick: AccessoryPick | null, slot: Slot, cell: AccessoryCell) =>
  pick != null && pick.slot === slot && sameLevels(pick.levels, cell.levels);

const GRADE_WORD: Record<string, string> = { LOW: "하", MID: "중", HIGH: "상" };

/** A listing's polish lines in short words ("적주피 상 · 추피 중"), in the official order. */
export function polishText(listing: AccessoryListing) {
  return listing.options
    .filter((o) => o.level)
    .map((o) => `${o.name} ${GRADE_WORD[o.level ?? ""] ?? ""}`.trim())
    .join(" · ");
}
