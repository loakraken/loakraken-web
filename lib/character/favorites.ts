// Favourite characters (per browser, #1119): starred on the character page or
// in the search dropdown, shown in the dropdown's 즐겨찾기 tab. Never sent to
// the server (the privacy page's "브라우저에만 저장" line covers it). Every
// storage access is guarded: with storage blocked the star still toggles for
// this page view and nothing breaks.
export type FavoriteCharacter = {
  name: string;
  server: string | null;
  className: string | null;
  itemLevel: number | null;
  at: number;
};

const FAVORITES = "loakraken:favorites";
export const FAVORITES_EVENT = "loakraken:favorites";
/** Room for a roster and a few friends; the oldest drops off past this. */
export const FAVORITES_LIMIT = 20;

const isEntry = (value: unknown): value is FavoriteCharacter => {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    v.name.length > 0 &&
    (v.server === null || typeof v.server === "string") &&
    (v.className === null || typeof v.className === "string") &&
    (v.itemLevel === null || typeof v.itemLevel === "number") &&
    typeof v.at === "number"
  );
};

/** Parses stored JSON defensively: anything malformed is dropped. */
export function parseFavorites(raw: string | null): FavoriteCharacter[] {
  try {
    const value = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter(isEntry).slice(0, FAVORITES_LIMIT) : [];
  } catch {
    return [];
  }
}

/** Newest first, one entry per name; adding a starred name removes it. */
export function toggleFavorite(list: FavoriteCharacter[], entry: FavoriteCharacter) {
  return list.some((item) => item.name === entry.name)
    ? list.filter((item) => item.name !== entry.name)
    : [entry, ...list].slice(0, FAVORITES_LIMIT);
}

const read = () => {
  try {
    return localStorage.getItem(FAVORITES);
  } catch {
    return null;
  }
};

/** Whether this browser keeps favourites at all (storage can be blocked). */
export function favoritesWritable() {
  try {
    const probe = `${FAVORITES}:probe`;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Raw snapshot for useSyncExternalStore (a string, so it compares by value). */
export const favoritesSnapshot = () => read() ?? "[]";
export const subscribeFavorites = (callback: () => void) => {
  window.addEventListener(FAVORITES_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(FAVORITES_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};

/** Stars or unstars a character; returns whether it is a favourite now. */
export function toggleStoredFavorite(entry: Omit<FavoriteCharacter, "at">): boolean {
  const next = toggleFavorite(parseFavorites(read()), { ...entry, at: Date.now() });
  try {
    localStorage.setItem(FAVORITES, JSON.stringify(next));
  } catch {
    /* Storage blocked: nothing persists. */
  }
  window.dispatchEvent(new Event(FAVORITES_EVENT));
  return next.some((item) => item.name === entry.name);
}
