import type { BackendFailure, BackendResult } from "../api/backend";
import type { Sort, SpecUpEnvelope } from "./model";
import type { GoalEnvelope } from "./goal";

export class SpecUpQueryError extends Error {
  info: BackendFailure;
  constructor(info: BackendFailure) {
    super(info.code);
    this.info = info;
  }
}

/** 스펙업 목표 경로 (api #455); target is sent as typed, two decimals at most. */
export async function fetchSpecUpGoal(characterName: string, target: number, signal?: AbortSignal) {
  const params = new URLSearchParams({ characterName, targetCombatPower: target.toFixed(2).replace(/\.?0+$/, "") });
  try {
    const response = await fetch(`/api/characters/spec-up/goal?${params}`, { cache: "no-store", signal });
    const result: BackendResult<GoalEnvelope> = await response.json();
    if (!result.ok) throw new SpecUpQueryError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof SpecUpQueryError || signal?.aborted) throw error;
    throw new SpecUpQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}

export async function fetchSpecUp(characterName: string, sort: Sort, signal?: AbortSignal) {
  const params = new URLSearchParams({ characterName, sort });
  try {
    const response = await fetch(`/api/characters/spec-up?${params}`, { cache: "no-store", signal });
    const result: BackendResult<SpecUpEnvelope> = await response.json();
    if (!result.ok) throw new SpecUpQueryError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof SpecUpQueryError || signal?.aborted) throw error;
    throw new SpecUpQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}
