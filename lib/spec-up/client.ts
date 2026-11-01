import type { BackendFailure, BackendResult } from "../api/backend";
import type { Sort, SpecUpEnvelope } from "./model";
import type { GoalEnvelope } from "./goal";
import type { DetailEnvelope } from "./detail";
import type { PathEnvelope, PathSort } from "./path";

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

/** 추천 순서 (api #794): the backend's chained order for one pick rule. */
export async function fetchSpecUpPath(characterName: string, sort: PathSort, signal?: AbortSignal) {
  const params = new URLSearchParams({ characterName, sort });
  try {
    const response = await fetch(`/api/characters/spec-up/path?${params}`, { cache: "no-store", signal });
    const result: BackendResult<PathEnvelope> = await response.json();
    if (!result.ok) throw new SpecUpQueryError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof SpecUpQueryError || signal?.aborted) throw error;
    throw new SpecUpQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}

/** One candidate's detail (opened row only). */
export async function fetchSpecUpDetail(
  characterName: string,
  candidateId: string,
  signal?: AbortSignal,
  includeCooldownGems: boolean | null = null,
) {
  const params = new URLSearchParams({ characterName });
  // api #588: the list's own cooldown-gem choice (a gem the list left out is not found).
  if (includeCooldownGems != null) params.set("includeCooldownGems", String(includeCooldownGems));
  try {
    const response = await fetch(`/api/characters/spec-up/candidates/${encodeURIComponent(candidateId)}?${params}`, {
      cache: "no-store",
      signal,
    });
    const result: BackendResult<DetailEnvelope> = await response.json();
    if (!result.ok) throw new SpecUpQueryError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof SpecUpQueryError || signal?.aborted) throw error;
    throw new SpecUpQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}

export async function fetchSpecUp(
  characterName: string,
  sort: Sort,
  signal?: AbortSignal,
  includeCooldownGems: boolean | null = null,
) {
  const params = new URLSearchParams({ characterName, sort });
  if (includeCooldownGems != null) params.set("includeCooldownGems", String(includeCooldownGems));
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
