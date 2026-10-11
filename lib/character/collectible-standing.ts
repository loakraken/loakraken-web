// Collectible standing and ownership (backend #304/#306): where the
// character's roster stands in the collectible ranking, and how many observed
// rosters own each collectible item. Both run on LOAKraken's observed sample
// and stay off on the backend until the ranking ships (404 then: the screen
// simply leaves them out).
import Ajv2020 from "ajv/dist/2020";
import standingContract from "../../contracts/collectible-standing.openapi.json";
import ownershipContract from "../../contracts/collectible-ownership.openapi.json";
import type { components as StandingSchemas } from "../api/collectible-standing-schema";
import type { components as OwnershipSchemas } from "../api/collectible-ownership-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { characterNameError, normalizeCharacterName } from "./model";
import { lazyValidator } from "@/lib/api/lazy-validator";

export type StandingEnvelope = StandingSchemas["schemas"]["ApiResponseCollectibleStandingResponse"];
export type CollectibleStanding = StandingSchemas["schemas"]["CollectibleStandingResponse"];
export type OwnershipEnvelope = OwnershipSchemas["schemas"]["ApiResponseCollectibleOwnershipResponse"];
export type OwnedItem = OwnershipSchemas["schemas"]["OwnedItemResponse"];

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
type Options = { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number };

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

/** Why there is no rank (string codes, more may come — PM-프론트 15:16). */
export function standingReason(code: string | null | undefined, activeDays: number | null | undefined) {
  switch (code) {
    case "EXCLUDED":
      return "순위 제외를 요청한 원정대예요.";
    case "NOT_OBSERVED":
      return "아직 확인한 기록이 없어요.";
    case "INACTIVE":
      return `최근 ${activeDays ?? 30}일 안에 확인되지 않았어요.`;
    case "NO_COLLECTIBLES":
      return "모은 수집품이 없어요.";
    default:
      return "순위를 낼 수 없어요.";
  }
}

/** Top percent rounded up at the first decimal ("상위 31.4%"), as the PM fixed it. */
export function topPercentText(value: number | null | undefined) {
  if (value == null) return null;
  return `${(Math.ceil(value * 10) / 10).toLocaleString("ko-KR")}%`;
}
