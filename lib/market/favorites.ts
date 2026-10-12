// Market item favourites (per browser), 품목 즐겨찾기: a starred
// item stays one click away across category tabs.
import { TAB_IDS, type TabId } from "./board";

export type FavoriteItem = {
  itemId: number;
  name: string;
  tab: TabId;
  tier: number | null;
  icon: string | null;
  grade: string | null;
};

const KEY = "loakraken:market-favorites";
export const MARKET_FAVORITES_EVENT = "loakraken:market-favorites";
export const MARKET_FAVORITES_LIMIT = 20;

const isFavorite = (value: unknown): value is FavoriteItem => {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(v.itemId) &&
    (v.itemId as number) > 0 &&
    typeof v.name === "string" &&
    (TAB_IDS as readonly unknown[]).includes(v.tab) &&
    (v.tier === null || Number.isInteger(v.tier)) &&
    (v.icon === null || typeof v.icon === "string") &&
    (v.grade === null || typeof v.grade === "string")
  );
};

export function parseFavorites(raw: string | null): FavoriteItem[] {
  try {
    const value = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter(isFavorite).slice(0, MARKET_FAVORITES_LIMIT) : [];
  } catch {
    return [];
  }
}

/** Adds (newest first) or removes the item. */
export function toggleFavorite(list: FavoriteItem[], item: FavoriteItem) {
  return list.some((f) => f.itemId === item.itemId)
    ? list.filter((f) => f.itemId !== item.itemId)
    : [item, ...list].slice(0, MARKET_FAVORITES_LIMIT);
}

export const favoritesSnapshot = () => {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
};
export const subscribeFavorites = (callback: () => void) => {
  window.addEventListener(MARKET_FAVORITES_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(MARKET_FAVORITES_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};
export function saveFavorite(item: FavoriteItem) {
  try {
    localStorage.setItem(KEY, JSON.stringify(toggleFavorite(parseFavorites(favoritesSnapshot()), item)));
    window.dispatchEvent(new Event(MARKET_FAVORITES_EVENT));
  } catch {
    /* Storage blocked: the star simply does not persist. */
  }
}
