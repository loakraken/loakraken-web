import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { DiscordLink } from "./discord-link";
import { KrakenMark } from "./kraken-mark";
import { SiteNav } from "./site-nav";
import styles from "./site-header.module.css";

/**
 * One header for every page: brand, the site-wide menu, then a page slot on
 * the right (search, motion toggle, call to action). `fixed` keeps the home
 * hero layout, every other page uses a sticky bar. The Discord link and the
 * theme toggle sit at the far right (light stays the default, D3).
 */
export function SiteHeader({
  children,
  fixed = false,
  className,
}: {
  children?: ReactNode;
  fixed?: boolean;
  className?: string;
}) {
  return (
    <header
      className={[styles.header, className].filter(Boolean).join(" ")}
      data-fixed={fixed || undefined}
    >
      <Link href="/" className={styles.brand} aria-label="LOAKraken 홈">
        <KrakenMark />
        <span>LOAKraken</span>
      </Link>
      <nav className={styles.nav} aria-label="주요 메뉴">
        <SiteNav />
      </nav>
      {children && <div className={styles.slot}>{children}</div>}
      <DiscordLink />
      <ThemeToggle className={styles.theme} />
    </header>
  );
}
