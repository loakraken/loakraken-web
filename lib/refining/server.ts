import "server-only";
import { requestAdvancedPlan, requestPlan } from "./upstream";

export const planRefining = (body: unknown, signal?: AbortSignal) =>
  requestPlan(body, process.env.LOAKRAKEN_API_ORIGIN, { signal });

/** 상급 재련 (web #1951): only while REFINING_ADVANCED is on (the route checks). */
export const planAdvancedRefining = (body: unknown, signal?: AbortSignal) =>
  requestAdvancedPlan(body, process.env.LOAKRAKEN_API_ORIGIN, { signal });

export { toResponse } from "../api/respond";
