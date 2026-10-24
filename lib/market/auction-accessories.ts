// T4 accessory prices on the auction house (api #139, API list #10 and the
// board it belongs to): for each slot, the lowest buy-now price of every
// grade combination of its key polish effects (상상~하중), and the cheapest
// listings of one combination. Board cached by the backend; a listings page
// costs at most one official call (1-minute cache).

import type { components } from "../api/auction-accessories-schema";

type Schemas = components["schemas"];
export type AccessoryBoardEnvelope = Schemas["ApiResponseAuctionAccessoryBoardResponse"];
export type AccessoryBoard = Schemas["AuctionAccessoryBoardResponse"];
export type AccessorySlot = Schemas["AuctionAccessorySlotResponse"];
export type AccessoryCell = Schemas["AuctionAccessoryCellResponse"];
export type AccessoryListingsEnvelope = Schemas["ApiResponseAuctionListingsResponse"];
export type AccessoryListing = Schemas["AuctionListingResponse"];

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
}export type Options = { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number };

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
