// Backend side of auction-gems.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// auction-gems.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/auction-gems.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { type GemSkillsEnvelope, type GemBoardEnvelope, type GemListingsEnvelope, type Options, type GemPick } from "./auction-gems";

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
