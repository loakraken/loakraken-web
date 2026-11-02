"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HUBS, type HubId } from "./nav-data";
import { focusClearOfFade } from "@/components/ui/focus-clear-of-fade";
import { useNavFlags, visible } from "./nav-flags";
import styles from "./hub-tabs.module.css";

/**
 * The tab row under a hub page's title (메뉴 합치기, 사용자 승인 10-26): one
 * link per page of the hub, the current one marked. Plain links rendered on
 * the server, so every tab is a page of its own for search and sharing; a
 * flagged tab joins at the end once the flags say it is on.
 */
export function HubTabs({ hub }: { hub: HubId }) {
  const pathname = usePathname();
  const flags = useNavFlags();
  const { label, tabs } = HUBS[hub];
  return (
    <nav className={`${styles.tabs} scroll-fade-x`} aria-label={`${label} 화면`} onFocus={focusClearOfFade}>
      {tabs
        .filter((tab) => visible(tab, flags))
        .map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.tab} hit-44`}
            aria-current={pathname === tab.href || tab.also?.includes(pathname) ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
    </nav>
  );
}
