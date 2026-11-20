import "server-only";
import { isArmorCpSimEnabled, isKarmaSimEnabled } from "../tools/flags";
import { requestOptions, requestSimulation } from "./upstream";

export const simulateCombatPower = (body: unknown, signal?: AbortSignal) =>
  requestSimulation(body, process.env.LOAKRAKEN_API_ORIGIN, { signal, karma: isKarmaSimEnabled(), armor: isArmorCpSimEnabled() });

export const getCombatPowerOptions = (signal?: AbortSignal) =>
  requestOptions(process.env.LOAKRAKEN_API_ORIGIN, { signal });

export { toResponse } from "../api/respond";
