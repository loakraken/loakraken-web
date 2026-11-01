// Collectible standing and ownership (backend #304/#306): where the
// character's roster stands in the collectible ranking, and how many observed
// rosters own each collectible item. Both run on LOAKraken's observed sample
// and stay off on the backend until the ranking ships (404 then: the screen
// simply leaves them out).

import type { components as StandingSchemas } from "../api/collectible-standing-schema";
import type { components as OwnershipSchemas } from "../api/collectible-ownership-schema";

export type StandingEnvelope = StandingSchemas["schemas"]["ApiResponseCollectibleStandingResponse"];
export type CollectibleStanding = StandingSchemas["schemas"]["CollectibleStandingResponse"];
export type OwnershipEnvelope = OwnershipSchemas["schemas"]["ApiResponseCollectibleOwnershipResponse"];
export type OwnedItem = OwnershipSchemas["schemas"]["OwnedItemResponse"];export type Options = { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number };

/** Why there is no rank (string codes, more may come — PM-프론트 15:16). */
export function standingReason(code: string | null | undefined, activeDays: number | null | undefined) {
  switch (code) {
    // A roster on the operators' processing-stop list reads exactly like one
    // with no record, so the two cannot be told apart (PM-프론트 00:59).
    case "EXCLUDED":
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
