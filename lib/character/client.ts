import type { CharacterResult, QueryFailure } from "./model";
import type { HistoryEnvelope, SiblingsEnvelope, ViewsEnvelope } from "./validate";
import type { CardCollectionEnvelope } from "./card-collection";

export class CharacterQueryError extends Error {
  info: QueryFailure;
  constructor(info: QueryFailure) {
    super(info.code);
    this.info = info;
  }
}

export async function fetchCharacter(name: string, signal: AbortSignal) {
  try {
    const response = await fetch(
      `/api/characters?${new URLSearchParams({ characterName: name })}`,
      { signal, cache: "no-store" },
    );
    const result: CharacterResult = await response.json();
    if (!result.ok) throw new CharacterQueryError(result.error);
    if (!response.ok || !result.envelope?.data)
      throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof CharacterQueryError || signal.aborted) throw error;
    throw new CharacterQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  try {
    const response = await fetch(path, { signal, cache: "no-store" });
    const result:
      { ok: true; envelope: T } | { ok: false; error: QueryFailure } =
      await response.json();
    if (!result.ok) throw new CharacterQueryError(result.error);
    if (!response.ok || !result.envelope) throw new Error("Invalid result");
    return result.envelope;
  } catch (error) {
    if (error instanceof CharacterQueryError || signal.aborted) throw error;
    throw new CharacterQueryError({ code: "LOST_ARK_API_ERROR", status: 502 });
  }
}

export const fetchSiblings = (name: string, signal: AbortSignal) =>
  getJson<SiblingsEnvelope>(
    `/api/characters/siblings?${new URLSearchParams({ characterName: name })}`,
    signal,
  );

export const fetchCardCollection = (name: string, signal: AbortSignal) =>
  getJson<CardCollectionEnvelope>(
    `/api/characters/card-collection?${new URLSearchParams({ characterName: name })}`,
    signal,
  );

export const fetchViews = (name: string, signal: AbortSignal) =>
  getJson<ViewsEnvelope>(
    `/api/characters/views?${new URLSearchParams({ characterName: name })}`,
    signal,
  );

export const fetchHistory = (
  name: string,
  server: string,
  signal: AbortSignal,
) =>
  getJson<HistoryEnvelope>(
    `/api/characters/history?${new URLSearchParams({ characterName: name, serverName: server })}`,
    signal,
  );
