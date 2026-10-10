import type { BackendFailure, BackendResult } from "../api/backend";
import type { OptionsEnvelope, SimulateEnvelope, SimulateRequest } from "./model";

export class CombatPowerQueryError extends Error {
  info: BackendFailure;
  constructor(info: BackendFailure) {
    super(info.code);
    this.info = info;
  }
}

async function call<T>(path: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
  try {
    const response = await fetch(path, { ...init, cache: "no-store", signal });
    const result: BackendResult<T> = await response.json();
    if (!result.ok) throw new CombatPowerQueryError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof CombatPowerQueryError || signal?.aborted) throw error;
    throw new CombatPowerQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}

export const postSimulation = (body: SimulateRequest, signal?: AbortSignal) =>
  call<SimulateEnvelope>(
    "/api/combat-power/simulate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    signal,
  );

export const fetchOptions = (signal?: AbortSignal) =>
  call<OptionsEnvelope>("/api/combat-power/options", {}, signal);
