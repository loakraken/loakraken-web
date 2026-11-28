import "server-only";
import { isArkGemSimEnabled, isArmorCpSimEnabled, isKarmaSimEnabled } from "../tools/flags";
import { requestGemRanking, requestOptions, requestSimulation } from "./upstream";

export const simulateCombatPower = (body: unknown, signal?: AbortSignal) =>
  requestSimulation(body, process.env.LOAKRAKEN_API_ORIGIN, {
    signal,
    karma: isKarmaSimEnabled(),
    armor: isArmorCpSimEnabled(),
    gem: isArkGemSimEnabled(),
  });

export const getCombatPowerOptions = (signal?: AbortSignal) =>
  requestOptions(process.env.LOAKRAKEN_API_ORIGIN, { signal });

/** 젬 가공 순위 (web #1969): only while GEM_RANKING is on (the route checks). */
export const rankGemProcessing = (body: unknown, signal?: AbortSignal) =>
  requestGemRanking(body, process.env.LOAKRAKEN_API_ORIGIN, { signal });

export { toResponse } from "../api/respond";
