import type { ItemTooltipsEnvelope } from "./item-tooltips";
import type { ArmoryPageEnvelope } from "./armory-page";
import type { CharacterResult, QueryFailure } from "./model";
import type { HistoryEnvelope, SiblingsEnvelope, ViewsEnvelope } from "./validate";
import type { CardCollectionEnvelope, CardRefreshEnvelope } from "./card-collection";
import type { PopularEnvelope, PopularPeriod } from "./popular";
import type { SuggestEnvelope } from "./suggest";
import type { RankEnvelope } from "./rank";
import type { OwnershipEnvelope, StandingEnvelope } from "./collectible-standing";
import type { TitlesEnvelope } from "./titles";
import type { ReceiptEnvelope } from "./receipt";

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

async function getJson<T>(path: string, signal: AbortSignal, method: "GET" | "POST" = "GET"): Promise<T> {
  try {
    const response = await fetch(path, { method, signal, cache: "no-store" });
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

export const fetchPopular = (period: PopularPeriod, signal: AbortSignal) =>
  getJson<PopularEnvelope>(`/api/characters/popular?period=${period}&limit=10`, signal);

export const fetchSuggest = (q: string, signal: AbortSignal) =>
  getJson<SuggestEnvelope>(`/api/characters/suggest?${new URLSearchParams({ q })}`, signal);

export const fetchReceipt = (name: string, assumeBook: boolean, signal: AbortSignal) =>
  getJson<ReceiptEnvelope>(
    `/api/characters/receipt?${new URLSearchParams({ characterName: name, assumeBook: String(assumeBook) })}`,
    signal,
  );

export const fetchCardCollection = (name: string, signal: AbortSignal) =>
  getJson<CardCollectionEnvelope>(
    `/api/characters/card-collection?${new URLSearchParams({ characterName: name })}`,
    signal,
  );

export const fetchCollectibleStanding = (name: string, signal: AbortSignal) =>
  getJson<StandingEnvelope>(
    `/api/characters/collectible-standing?${new URLSearchParams({ characterName: name })}`,
    signal,
  );

export const fetchCollectibleOwnership = (type: string, signal: AbortSignal) =>
  getJson<OwnershipEnvelope>(`/api/collectibles/ownership?${new URLSearchParams({ type })}`, signal);

export const fetchRank = (name: string, signal: AbortSignal) =>
  getJson<RankEnvelope>(
    `/api/characters/rank?${new URLSearchParams({ characterName: name })}`,
    signal,
  );

export const fetchArmoryPage = (name: string, signal: AbortSignal) =>
  getJson<ArmoryPageEnvelope>(`/api/characters/armory-page?${new URLSearchParams({ characterName: name })}`, signal);

export const fetchItemTooltips = (name: string, signal: AbortSignal) =>
  getJson<ItemTooltipsEnvelope>(
    `/api/characters/item-tooltips?${new URLSearchParams({ characterName: name })}`,
    signal,
  );

export const fetchTitles = (name: string, signal: AbortSignal) =>
  getJson<TitlesEnvelope>(
    `/api/characters/titles?${new URLSearchParams({ characterName: name })}`,
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

/** Refill the roster card records (POST; the backend reads up to 12 characters). */
export const postCardRefresh = (name: string, signal: AbortSignal) =>
  getJson<CardRefreshEnvelope>(
    `/api/characters/card-collection/refresh?${new URLSearchParams({ characterName: name })}`,
    signal,
    "POST",
  );
