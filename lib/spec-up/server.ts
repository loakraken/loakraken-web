import "server-only";
import { requestSpecUp, requestSpecUpGoal } from "./upstream";

export const getSpecUp = (characterName: string, sort: string | null, signal?: AbortSignal) =>
  requestSpecUp(characterName, sort, process.env.LOAKRAKEN_API_ORIGIN, { signal });

export const getSpecUpGoal = (characterName: string, target: string | null, signal?: AbortSignal) =>
  requestSpecUpGoal(characterName, target, process.env.LOAKRAKEN_API_ORIGIN, { signal });

export { toResponse } from "../api/respond";
