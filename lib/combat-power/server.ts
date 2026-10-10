import "server-only";
import { requestOptions, requestSimulation } from "./upstream";

export const simulateCombatPower = (body: unknown, signal?: AbortSignal) =>
  requestSimulation(body, process.env.LOAKRAKEN_API_ORIGIN, { signal });

export const getCombatPowerOptions = (signal?: AbortSignal) =>
  requestOptions(process.env.LOAKRAKEN_API_ORIGIN, { signal });

export { toResponse } from "../api/respond";
