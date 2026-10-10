import "server-only";
import { requestCritSpeed } from "./upstream";

export const calculateCritSpeed = (body: unknown, signal?: AbortSignal) =>
  requestCritSpeed(body, process.env.LOAKRAKEN_API_ORIGIN, { signal });

export { toResponse } from "../api/respond";
