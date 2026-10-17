"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { BookmarkBold, CloseCircle } from "@/components/ui/icons";
import {
  clearRecent,
  readSnapshot,
  recentSnapshot,
  removeRecent,
  setRecentSaving,
  subscribeRecent,
} from "@/lib/character/recent";
import { PillTab, PillTabs, PillTabsPanel } from "@/components/ui/pill-tabs";
import styles from "./home.module.css";
import { useTallest } from "@/components/ui/use-tallest";

/* Favourites written by the character page (names only, per browser). */
const FAVORITES = "loakraken:favorites";
const favoritesSnapshot = () => {
  try {
    return localStorage.getItem(FAVORITES) ?? "[]";
  } catch {
    return "[]";
  }
};
const subscribeFavorites = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("loakraken:favorites", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("loakraken:favorites", callback);
  };
};
const parseNames = (raw: string) => {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
};

const level = (value: number | null) =>
  value == null ? "-" : value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const power = (value: number | null | undefined) =>
  value == null ? null : Math.round(value).toLocaleString("ko-KR");

/** Unstar from the home card; the character page reads the same list. */
function removeFavorite(name: string) {
  try {
    localStorage.setItem(FAVORITES, JSON.stringify(parseNames(favoritesSnapshot()).filter((n) => n !== name)));
    window.dispatchEvent(new Event("loakraken:favorites"));
  } catch {
    /* Storage blocked. */
  }
}

/**
 * Recent searches card: 최근 검색 / 즐겨찾기 tabs, each row with
 * item level and server · class, a "검색어 저장" switch and 전체 삭제.
 */
export function RecentCard() {
  const snapshot = useSyncExternalStore(subscribeRecent, recentSnapshot, () => null);
  const favoritesRaw = useSyncExternalStore(subscribeFavorites, favoritesSnapshot, () => "[]");
  const { saving, list } = useMemo(
    () => (snapshot === null ? { saving: true, list: [] } : readSnapshot(snapshot)),
    [snapshot],
  );
  const favorites = useMemo(() => parseNames(favoritesRaw), [favoritesRaw]);
  const [tab, setTab] = useState<"recent" | "favorites">("recent");
  // Both lists keep the room of the taller one, so switching does not pull
  // up the cards below (A7).
  const [bodyRef, bodyHeight] = useTallest();
  const known = new Map(list.map((item) => [item.name, item]));
  const rows =
    tab === "recent"
      ? list
      : favorites.map(
          (name) => known.get(name) ?? { name, server: null, className: null, itemLevel: null, at: 0 },
        );

  return (
    <section className={styles.panel} aria-labelledby="recent-heading">
      <h2 id="recent-heading" className={styles.srOnly}>
        최근 검색과 즐겨찾기
      </h2>
      <PillTabs
        aria-label="목록 선택"
        className={styles.cardTabs}
        listClassName={styles.recentTabList}
        value={tab}
        onValueChange={(value) => setTab(value as "recent" | "favorites")}
        panels={
          <PillTabsPanel value={tab}>
            <div ref={bodyRef} style={bodyHeight ? { minHeight: bodyHeight } : undefined}>
              {rows.length === 0 ? (
                <p className={styles.muted}>
                  {tab === "favorites"
                    ? "캐릭터 화면의 별을 누르면 여기에 모여요."
                    : saving
                      ? "검색한 캐릭터가 여기에 표시돼요."
                      : "검색어 저장이 꺼져 있어요."}
                </p>
              ) : (
                <ul className={styles.recentList}>
                  {rows.map((item) => (
                    <li key={item.name}>
                      <Link href={`/character/${encodeURIComponent(item.name)}`}>
                        <span className={styles.recentName}>
                          <strong>{item.name}</strong>
                          <small>
                            {[item.server, item.className].filter(Boolean).join(" · ") || "정보 없음"}
                          </small>
                        </span>
                        <span className={styles.recentLevel}>
                          <b>{level(item.itemLevel)}</b>
                          {power(item.combatPower) && <small>전투력 {power(item.combatPower)}</small>}
                        </span>
                      </Link>
                      {tab === "recent" ? (
                        <button
                          type="button"
                          className={styles.remove}
                          aria-label={`${item.name} 기록 삭제`}
                          onClick={() => removeRecent(item.name)}
                        >
                          <CloseCircle size={14} aria-hidden="true" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.remove}
                          aria-label={`${item.name} 즐겨찾기 해제`}
                          onClick={() => removeFavorite(item.name)}
                        >
                          <BookmarkBold size={14} aria-hidden="true" className={styles.starOn} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {tab === "recent" && (
                <div className={styles.recentFoot}>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      checked={saving}
                      onChange={(event) => setRecentSaving(event.target.checked)}
                    />
                    검색어 저장
                  </label>
                  {list.length > 0 && (
                    <button type="button" className={styles.textButton} onClick={clearRecent}>
                      전체 삭제
                    </button>
                  )}
                </div>
              )}
            </div>
          </PillTabsPanel>
        }
      >
        <PillTab value="recent">
          최근 검색 <span className={styles.tabCount}>{list.length}</span>
        </PillTab>
        <PillTab value="favorites">
          즐겨찾기 <span className={styles.tabCount}>{favorites.length}</span>
        </PillTab>
      </PillTabs>
    </section>
  );
}
