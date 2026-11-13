"use client";

// The market's one category row (user 11-12): the exchange categories, then 보석 and 장신구,
// instead of separate top tabs. The exchange categories switch in place on /market; 보석 and
// 장신구 are pages of their own (own URL, title and canonical), so picking one goes there, and
// on those pages an exchange category goes back to /market with it chosen.
//
// Every item is a link to where it leads (codex #1597 P2-3): open in a new tab, copy the link
// and a press before the page has woken all work. On /market a plain press on an exchange
// category switches in place instead (the board's own URL sync). The row is the same fixed
// list on the server and in the browser (P2-2), and the chosen item is in view from the first
// HTML on phones (P2-1): CSS `scroll-initial-target`, with a reveal after load where a browser
// lacks it.
import { useLayoutEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AddSquare,
  BookSquare,
  Box,
  Coffee,
  Diamonds,
  Flash,
  Gift,
  Heart,
  HierarchySquare,
  MagicStar,
  Tree,
} from "@/components/ui/icons";
import { focusClearOfFade } from "@/components/ui/focus-clear-of-fade";
import { cn } from "cn";
import { TAB_FALLBACK, isTabId, type TabId } from "@/lib/market/board";
import { fetchMarketTabs } from "@/lib/market/client";

// One Iconsax mark per category (decorative; the label names the tab).
const TAB_ICON: Record<string, ReactNode> = {
  REFINING: <MagicStar />,
  REFINING_EXTRA: <AddSquare />,
  ARK_GRID: <HierarchySquare />,
  WEAPON_EVOLUTION: <Flash />,
  ENGRAVING_BOOK: <BookSquare />,
  LIFE: <Tree />,
  BATTLE_ITEM: <Box />,
  FOOD: <Coffee />,
  AVATAR: <Diamonds />,
  EQUIPMENT_BOX: <Gift />,
};

/** The auction-house boards, last in the row. */
export const AUCTION_CATEGORIES = [
  { value: "GEM", label: "보석", href: "/market/gems", icon: <Diamonds /> },
  { value: "ACCESSORY", label: "장신구", href: "/market/accessories", icon: <Heart /> },
] as const;
export type AuctionCategory = (typeof AUCTION_CATEGORIES)[number]["value"];

// The chosen item is the scroller's first scroll target (Chrome 133+), so a phone shows it from the
// first paint; 28px clear of the row's end fade.
const INITIAL: CSSProperties = { scrollInitialTarget: "nearest", scrollMarginInline: 28 } as CSSProperties;

const item = cn(
  "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 whitespace-nowrap select-none no-underline",
  // 44px to tap on phones, inside the list's 4px padding (A36); at least 40px wide, so an item drawn
  // before its label arrived keeps its tap area where it ends up (pill-tabs-late-part).
  "hit-44 min-w-10",
  "text-(length:--text-body) leading-none font-medium text-muted-foreground",
  "transition-[color,scale] duration-(--duration-fast) ease-(--ease-out)",
  "pointer-fine:not-aria-[current=page]:hover:text-foreground active:scale-[0.96]",
  // The chosen item: the face on a 1px --input ring (3:1 edge, WCAG 1.4.11), as the pill tabs draw it.
  "aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-[0_0_0_1px_var(--input)]",
  "dark:aria-[current=page]:bg-secondary",
  "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ring)",
  "[&_svg]:size-4 [&_svg]:shrink-0",
);

export function MarketCategoryRow({
  value,
  onExchange,
}: {
  /** The chosen category: an exchange tab id, or GEM / ACCESSORY on those pages. */
  value: TabId | AuctionCategory;
  /** On /market: switch the exchange category in place. Elsewhere its link opens /market with it. */
  onExchange?: (tab: TabId) => void;
}) {
  // Only to leave out a category an api does not open (an answer without it). The names and order
  // are the fixed list, so the row is final from the first HTML and never changes after it.
  const tabs = useQuery({
    queryKey: ["market", "tabs"],
    queryFn: ({ signal }) => fetchMarketTabs(signal),
    staleTime: 10 * 60_000,
  });
  const live = tabs.data?.data.tabs.filter((t) => isTabId(t.tab)).map((t) => t.tab);
  const scroller = useRef<HTMLDivElement>(null);

  // A browser without scroll-initial-target: bring the chosen item into the row once, before paint.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || CSS.supports("scroll-initial-target", "nearest")) return;
    const chosen = el.querySelector<HTMLElement>("[aria-current=page]");
    if (!chosen) return;
    const pad = 28;
    const left = chosen.offsetLeft - pad;
    const right = chosen.offsetLeft + chosen.offsetWidth + pad - el.clientWidth;
    if (left < el.scrollLeft) el.scrollLeft = left;
    else if (right > el.scrollLeft) el.scrollLeft = right;
  }, [value]);

  // A new tab or window (modifier, middle button) is the browser's own; only a plain press is ours.
  const plain = (event: MouseEvent<HTMLAnchorElement>) =>
    !event.defaultPrevented && event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
  const inPlace = (tab: TabId) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onExchange || !plain(event)) return;
    event.preventDefault();
    onExchange(tab);
  };

  const entries = [
    ...TAB_FALLBACK.map((t) => ({
      key: t.tab,
      label: t.label,
      icon: TAB_ICON[t.tab],
      href: `/market?tab=${t.tab}`,
      open: !live || live.includes(t.tab),
      onClick: inPlace(t.tab),
      prefetch: false,
    })),
    ...AUCTION_CATEGORIES.map((c) => ({
      key: c.value,
      label: c.label,
      icon: c.icon,
      href: c.href,
      open: true,
      onClick: undefined,
      prefetch: undefined,
    })),
  ];

  return (
    <nav aria-label="시세 분류" data-slot="category-row" className="w-max max-w-full min-w-0 rounded-full bg-muted">
      <div
        ref={scroller}
        onFocus={focusClearOfFade}
        className={cn(
          "max-w-full overflow-x-auto overscroll-x-contain scroll-fade-x [--scroll-fade-size:28px]",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // A link reached by keyboard rests clear of the end fade (read by focusClearOfFade).
          "scroll-px-7",
        )}
      >
        <ul className="m-0 flex w-max list-none gap-1 p-1">
          {entries.map((e) => {
            const current = e.key === value;
            const body = (
              <>
                {e.icon && (
                  <span aria-hidden="true" className="inline-grid">
                    {e.icon}
                  </span>
                )}
                {e.label}
              </>
            );
            return (
              <li key={e.key} className="flex">
                {e.open ? (
                  <Link
                    href={e.href}
                    prefetch={e.prefetch}
                    className={item}
                    aria-current={current ? "page" : undefined}
                    style={current ? INITIAL : undefined}
                    // The page it is already on: a plain press does nothing (no reload).
                    onClick={current ? (event) => plain(event) && event.preventDefault() : e.onClick}
                  >
                    {body}
                  </Link>
                ) : (
                  // An api that does not open this category: kept in its place (the row never moves).
                  <span className={cn(item, "cursor-not-allowed opacity-40")} data-unavailable="">
                    {body}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
