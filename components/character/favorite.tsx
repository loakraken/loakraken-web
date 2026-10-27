"use client";

import { useSyncExternalStore } from "react";
import { Bookmark, BookmarkBold } from "@/components/ui/icons";
import { favoritesSnapshot, parseFavorites, subscribeFavorites, toggleStoredFavorite } from "@/lib/character/favorites";
import styles from "./character.module.css";

// One list with the search dropdown's 즐겨찾기 tab and the home card (#1119).
export function useFavorite(name: string) {
  const favorite = useSyncExternalStore(
    subscribeFavorites,
    () => parseFavorites(favoritesSnapshot()).includes(name),
    () => false,
  );
  const toggle = () => void toggleStoredFavorite(name);
  return [favorite, toggle] as const;
}

/**
 * The favourite toggle beside the name on a narrow screen (#1148): the tab
 * row's own toggle is hidden there (A35), so phones still see and press one.
 * Present from the first paint and the same size either way (no shift).
 */
export function BannerFavorite({ name }: { name: string }) {
  const [favorite, toggle] = useFavorite(name);
  return (
    <button
      type="button"
      className={styles.bannerFavorite}
      onClick={toggle}
      aria-pressed={favorite}
      aria-label={favorite ? "즐겨찾기 해제" : "즐겨찾기"}
    >
      {favorite ? <BookmarkBold size={18} aria-hidden="true" /> : <Bookmark size={18} aria-hidden="true" />}
    </button>
  );
}
