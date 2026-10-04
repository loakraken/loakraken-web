import type { CharacterResult, QueryFailure } from "./model";

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
