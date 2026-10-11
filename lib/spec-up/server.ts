import "server-only";
import { requestSpecUp } from "./upstream";

export const getSpecUp = (characterName: string, sort: string | null, signal?: AbortSignal) =>
  requestSpecUp(characterName, sort, process.env.LOAKRAKEN_API_ORIGIN, { signal });

export { toResponse } from "../api/respond";
