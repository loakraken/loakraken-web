import "server-only";
import { requestAccessorySearch } from "./upstream";

export const searchAccessories = (body: unknown, signal?: AbortSignal) =>
  requestAccessorySearch(body, process.env.LOAKRAKEN_API_ORIGIN, { signal });

export { toResponse } from "../api/respond";
