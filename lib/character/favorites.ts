// Favourite characters (per browser): the character page's 즐겨찾기 button,
// the home card and the search dropdown's 즐겨찾기 tab (#1119) share one list
// of names under one key. Never sent to the server (the privacy page's
// "브라우저에만 저장" line covers it). Every storage access is guarded: with
// storage blocked nothing persists and nothing breaks.
const FAVORITES = "loakraken:favorites";
export const FAVORITES_EVENT = "loakraken:favorites";
/** The cap the character page has always used; the oldest drops off past it. */
export const FAVORITES_LIMIT = 30;

/** Parses stored JSON defensively: names only, anything else dropped. */
export function parseFavorites(raw: string | null): string[] {
  try {
    const value = JSON.parse(raw ?? "[]");
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string" && v.length > 0).slice(0, FAVORITES_LIMIT)
      : [];
  } catch {
    return [];
  }
}

/** Newest first; a starred name is removed instead. */
export function toggleFavorite(list: string[], name: string) {
  return list.includes(name) ? list.filter((n) => n !== name) : [name, ...list].slice(0, FAVORITES_LIMIT);
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

/** Stars or unstars a name; returns whether it is a favourite now. */
export function toggleStoredFavorite(name: string): boolean {
  const next = toggleFavorite(parseFavorites(read()), name);
  try {
    localStorage.setItem(FAVORITES, JSON.stringify(next));
  } catch {
    /* Storage blocked: nothing persists. */
  }
  window.dispatchEvent(new Event(FAVORITES_EVENT));
  return next.includes(name);
}
