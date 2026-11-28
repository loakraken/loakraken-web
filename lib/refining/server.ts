import "server-only";
import { requestAdvancedPlan, requestPlan, requestSpecialStoneValues } from "./upstream";

export const planRefining = (body: unknown, signal?: AbortSignal) =>
  requestPlan(body, process.env.LOAKRAKEN_API_ORIGIN, { signal });

/** 상급 재련 (web #1951): only while REFINING_ADVANCED is on (the route checks). */
export const planAdvancedRefining = (body: unknown, signal?: AbortSignal) =>
  requestAdvancedPlan(body, process.env.LOAKRAKEN_API_ORIGIN, { signal });

/** M42 돌파석 가치 (api #1099): only while SPECIAL_STONE is on (the route checks). */
export const specialStoneValues = (body: unknown, signal?: AbortSignal) =>
  requestSpecialStoneValues(body, process.env.LOAKRAKEN_API_ORIGIN, { signal });

export { toResponse } from "../api/respond";
