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

// Each favourite's character image, saved when it is starred or its page is
// seen, for the search dropdown's 즐겨찾기 rows. Beside the name list (not in
// it), so every reader of the names keeps working; a name without an image
// shows its first letter until its page is opened again.
const IMAGES = "loakraken:favorite-images";

/** Parses stored JSON defensively: string addresses by name, anything else dropped. */
export function parseFavoriteImages(raw: string | null): Record<string, string> {
  try {
    const value: unknown = JSON.parse(raw ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((e): e is [string, string] => typeof e[1] === "string" && e[1].length > 0),
    );
  } catch {
    return {};
  }
}

/** The images kept for the favourites only, with one name's set or cleared. */
export function withFavoriteImage(
  images: Record<string, string>,
  favorites: string[],
  name: string,
  image: string | null | undefined,
) {
  const next = Object.fromEntries(Object.entries(images).filter(([key]) => favorites.includes(key)));
  if (image && favorites.includes(name)) next[name] = image;
  return next;
}

const readImages = () => {
  try {
    return localStorage.getItem(IMAGES);
  } catch {
    return null;
  }
};
const writeImages = (favorites: string[], name: string, image: string | null | undefined) => {
  try {
    localStorage.setItem(IMAGES, JSON.stringify(withFavoriteImage(parseFavoriteImages(readImages()), favorites, name, image)));
  } catch {
    /* Storage blocked: rows show the first letter. */
  }
};

export const favoriteImagesSnapshot = () => readImages() ?? "{}";

/** Keeps a favourite's image current when its page is seen (no-op for others). */
export function refreshFavoriteImage(name: string, image: string | null | undefined) {
  const favorites = parseFavorites(read());
  if (!image || !favorites.includes(name) || parseFavoriteImages(readImages())[name] === image) return;
  writeImages(favorites, name, image);
  window.dispatchEvent(new Event(FAVORITES_EVENT));
}

/** Stars or unstars a name (with its image, when known); returns whether it is a favourite now. */
export function toggleStoredFavorite(name: string, image?: string | null): boolean {
  const next = toggleFavorite(parseFavorites(read()), name);
  try {
    localStorage.setItem(FAVORITES, JSON.stringify(next));
  } catch {
    /* Storage blocked: nothing persists. */
  }
  writeImages(next, name, image);
  window.dispatchEvent(new Event(FAVORITES_EVENT));
  return next.includes(name);
}
