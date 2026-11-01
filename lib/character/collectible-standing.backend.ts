// Backend side of collectible-standing.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// collectible-standing.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import standingContract from "../../contracts/collectible-standing.openapi.json";
import ownershipContract from "../../contracts/collectible-ownership.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { characterNameError, normalizeCharacterName } from "./model";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { type StandingEnvelope, type OwnershipEnvelope, type Options } from "./collectible-standing";

const ajv = () => new Ajv2020({ strict: false, validateFormats: false });

const validateStanding = lazyValidator(() =>
  ajv().compile<StandingEnvelope>({
    $ref: "#/components/schemas/ApiResponseCollectibleStandingResponse",
    components: { ...standingContract.components, schemas: tolerantSchemas(standingContract.components.schemas) },
  }),
);

const validateOwnership = lazyValidator(() =>
  ajv().compile<OwnershipEnvelope>({
    $ref: "#/components/schemas/ApiResponseCollectibleOwnershipResponse",
    components: { ...ownershipContract.components, schemas: tolerantSchemas(ownershipContract.components.schemas) },
  }),
);

export const isStandingEnvelope = (value: unknown): value is StandingEnvelope =>
  validateStanding(value) && value.code === "COLLECTIBLE_STANDING_SUCCESS";

export const isOwnershipEnvelope = (value: unknown): value is OwnershipEnvelope =>
  validateOwnership(value) && value.code === "COLLECTIBLE_OWNERSHIP_SUCCESS";

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE"],
  503: ["STATS_UNAVAILABLE"],
};

const invalid = { ok: false as const, error: { code: "INVALID_REQUEST", status: 400 } };

/** The roster's standing, default conditions (last 30 days, roster unit). */
export function requestCollectibleStanding(
  name: string,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<StandingEnvelope>> {
  if (characterNameError(name)) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/rankings/collectibles/standing");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  return requestBackend(url, { ...options, isValid: isStandingEnvelope, errorCodes });
}

/** Ownership of every item in one official collectible kind. */
export function requestCollectibleOwnership(
  type: string,
  origin: string | undefined,
  options: Options = {},
): Promise<BackendResult<OwnershipEnvelope>> {
  const kind = type.trim();
  if (!kind || kind.length > 24) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/collectibles/ownership");
  url?.searchParams.set("type", kind);
  return requestBackend(url, { ...options, isValid: isOwnershipEnvelope, errorCodes });
}
