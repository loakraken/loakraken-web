import "server-only";
import { requestPlan } from "./upstream";

export const planRefining = (body: unknown, signal?: AbortSignal) =>
  requestPlan(body, process.env.LOAKRAKEN_API_ORIGIN, { signal });

export { toResponse } from "../api/respond";
