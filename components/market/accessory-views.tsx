"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./accessory-views.module.css";

export const ACCESSORY_BOARD_PATH = "/market/accessories";
export const ACCESSORY_SEARCH_PATH = "/market/accessories/search";

/**
 * The two views of the 장신구 tab (user 11-02: 장신구 시세 and 악세 검색 in
 * one screen, one entry in the 시세 hub). Plain links, each view a page of its
 * own for sharing. `search` comes from the page's server-side switch, so both
 * links are in the first HTML and nothing joins later (A7).
 */
export function AccessoryViews({ search }: { search: boolean }) {
  const pathname = usePathname();
  const views = [
    { label: "시세", href: ACCESSORY_BOARD_PATH },
    ...(search ? [{ label: "매물 검색", href: ACCESSORY_SEARCH_PATH }] : []),
  ];
  if (views.length < 2) return null;
  return (
    <nav className={styles.views} aria-label="장신구 보기">
      {views.map((view) => (
        <Link
          key={view.href}
          href={view.href}
          className={`${styles.view} hit-44`}
          aria-current={pathname === view.href ? "page" : undefined}
        >
          {view.label}
        </Link>
      ))}
    </nav>
  );
}
