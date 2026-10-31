// Backend side of auction-accessories.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// auction-accessories.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/auction-accessories.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { type AccessoryBoardEnvelope, type AccessoryListingsEnvelope, type AccessoryFilter, type Options, type AccessoryPick } from "./auction-accessories";

// `filter` (api #548, always null here) and a listing's `icon` (api #613) are
// required in the contract, but a backend from before them answers without:
// optional until that backend is gone. Without an icon the card shows no picture.
const schemas = (() => {
  const all = tolerantSchemas(contract.components.schemas);
  const listings = all.AuctionListingsResponse;
  const listing = all.AuctionListingResponse;
  return {
    ...all,
    AuctionListingsResponse: { ...listings, required: listings.required.filter((key) => key !== "filter") },
    AuctionListingResponse: { ...listing, required: listing.required.filter((key) => key !== "icon") },
  };
})();

const compile = <T>(ref: string) =>
  lazyValidator(() =>
    new Ajv2020({ strict: false, validateFormats: false }).compile<T>({
      $ref: `#/components/schemas/${ref}`,
      components: { ...contract.components, schemas },
    }),
  );

const validateBoard = compile<AccessoryBoardEnvelope>("ApiResponseAuctionAccessoryBoardResponse");

const validateListings = compile<AccessoryListingsEnvelope>("ApiResponseAuctionListingsResponse");

export const isAccessoryBoardEnvelope = (value: unknown): value is AccessoryBoardEnvelope =>
  validateBoard(value) && value.code === "AUCTION_ACCESSORIES_SUCCESS";

export const isAccessoryListingsEnvelope = (value: unknown): value is AccessoryListingsEnvelope =>
  validateListings(value) && value.code === "AUCTION_LISTINGS_SUCCESS";

const filterParams = (filter: AccessoryFilter) =>
  new URLSearchParams({ grade: filter.grade, role: filter.role, minQuality: String(filter.minQuality) });

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "INVALID_AUCTION_LEVELS"],
  429: ["LOST_ARK_RATE_LIMITED", "CLIENT_RATE_LIMITED"],
  502: ["LOST_ARK_API_ERROR"],
  503: ["LOST_ARK_NOT_CONFIGURED"],
  504: ["LOST_ARK_API_TIMEOUT"],
};

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
