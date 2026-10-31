import "server-only";
import { requestSpecUp, requestSpecUpDetail, requestSpecUpGoal, requestSpecUpPath } from "./upstream";

export const getSpecUp = (
  characterName: string,
  sort: string | null,
  signal?: AbortSignal,
  includeCooldownGems: string | null = null,
) => requestSpecUp(characterName, sort, process.env.LOAKRAKEN_API_ORIGIN, { signal }, includeCooldownGems);

export const getSpecUpGoal = (characterName: string, target: string | null, signal?: AbortSignal) =>
  requestSpecUpGoal(characterName, target, process.env.LOAKRAKEN_API_ORIGIN, { signal });

export const getSpecUpPath = (characterName: string, sort: string | null, signal?: AbortSignal) =>
  requestSpecUpPath(characterName, sort, process.env.LOAKRAKEN_API_ORIGIN, { signal });

export const getSpecUpDetail = (
  characterName: string,
  candidateId: string,
  signal?: AbortSignal,
  includeCooldownGems: string | null = null,
) => requestSpecUpDetail(characterName, candidateId, process.env.LOAKRAKEN_API_ORIGIN, { signal }, includeCooldownGems);

export { toResponse } from "../api/respond";
