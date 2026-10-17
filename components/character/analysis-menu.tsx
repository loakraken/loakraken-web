"use client";

import { createContext, useContext, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { Bookmark, BookmarkBold, ChevronDown, Share } from "@/components/ui/icons";
import { chromeBottom } from "@/components/ui/item-tooltip";
import { analysisLinks } from "@/lib/character/analysis";
import { cn } from "cn";
import styles from "./detail.module.css";

/** CRIT_SPEED_TOOL (server flag): off leaves the calculator out of the menu. */
export const CritSpeedEnabled = createContext(true);

/** Below this width share and favorite live in the menu (A35): the tabs keep two whole items. */
const NARROW = "(max-width: 560px)";
/** Room kept between the menu and the screen edges or the pinned chrome. */
const EDGE = 12;
const watchNarrow = (change: () => void) => {
  const query = matchMedia(NARROW);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};

/**
 * 분석 (character screen checklist §14.1 ③): the tools that take this
 * character, beside the tabs. A tab of this page replaces the history entry
 * like the tab links; a tool opens with the character filled in. On a narrow
 * screen it reads 더보기 and also holds share and favorite (A35).
 */
export function AnalysisMenu({
  name,
  server,
  specUp,
  simulator,
  className,
  classEngraving,
  favorite,
  onShare,
  onFavorite,
}: {
  name: string;
  server: string | null | undefined;
  specUp: boolean;
  simulator: boolean;
  className?: string | null;
  classEngraving?: string | null;
  favorite: boolean;
  onShare: () => void;
  onFavorite: () => void;
}) {
  const links = analysisLinks(name, server, { specUp, simulator, critSpeed: useContext(CritSpeedEnabled) }, { className, classEngraving });
  // Read when the menu opens (the popup is never in the first HTML).
  const narrow = useSyncExternalStore(watchNarrow, () => matchMedia(NARROW).matches, () => false);
  // The pinned header and tab bar, measured as it opens (the page does not
  // scroll while it is open): the menu opens upward only if it fits below
  // them, and never covers them (A15).
  const [top, setTop] = useState(EDGE);
  return (
    <Menu.Root
      onOpenChange={(open) => {
        if (open) setTop(chromeBottom() + EDGE);
      }}
    >
      <Menu.Trigger className={styles.analysisTrigger}>
        <span className={styles.wideOnly}>분석</span>
        <span className={styles.narrowOnly}>더보기</span>
        <ChevronDown size={14} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        {/* Narrow: centred under its trigger (A33), the screen edges only
            nudging it; wide: its right edge on the trigger's, as before. */}
        <Menu.Positioner
          side="bottom"
          align={narrow ? "center" : "end"}
          sideOffset={6}
          collisionPadding={{ top, right: EDGE, bottom: EDGE, left: EDGE }}
          className="isolate z-50 outline-none"
        >
          <Menu.Popup
            className={cn(
              "w-[min(280px,calc(100vw-24px))] p-1 outline-none",
              // A short screen: the items scroll inside rather than run off it.
              "max-h-(--available-height) overflow-y-auto overscroll-contain",
              "rounded-(--radius-md) bg-(--surface-panel) text-foreground shadow-(--shadow-card) ring-1 ring-(--border)",
              "origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-(--ease-out)",
              "data-starting-style:scale-[0.98] data-starting-style:opacity-0",
              "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-100",
              "motion-reduce:transition-none",
            )}
          >
            {links.map((link) => (
              <Menu.LinkItem
                key={link.id}
                render={<Link href={link.href} prefetch={false} replace={link.tab} />}
                className={cn(
                  "grid gap-0.5 rounded-(--radius-sm) px-3 py-2 outline-none select-none",
                  "data-highlighted:bg-muted",
                )}
              >
                <span className="text-(length:--text-body) font-semibold">{link.label}</span>
                <span className="text-xs text-muted-foreground">{link.description}</span>
              </Menu.LinkItem>
            ))}
            {narrow && (
              <>
                <Menu.Separator className="mx-2 my-1 h-px bg-(--border)" />
                {[
                  { key: "share", label: "공유하기", icon: <Share size={16} aria-hidden="true" />, act: onShare },
                  {
                    key: "favorite",
                    label: favorite ? "즐겨찾기 해제" : "즐겨찾기",
                    icon: favorite ? <BookmarkBold size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />,
                    act: onFavorite,
                  },
                ].map((item) => (
                  <Menu.Item
                    key={item.key}
                    onClick={item.act}
                    className={cn(
                      "flex items-center gap-2 rounded-(--radius-sm) px-3 py-2.5 outline-none select-none",
                      "text-(length:--text-body) font-semibold data-highlighted:bg-muted",
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Menu.Item>
                ))}
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
