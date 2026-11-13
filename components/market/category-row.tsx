"use client";

// The market's one category row (user 11-12): the exchange categories, then 보석 and 장신구,
// instead of separate top tabs. The exchange categories switch in place on /market; 보석 and
// 장신구 are pages of their own (own URL, title and canonical), so picking one goes there, and
// on those pages an exchange category goes back to /market with it chosen.
import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
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
import { PillTab, PillTabs } from "@/components/ui/pill-tabs";
import { TAB_FALLBACK, isTabId, type MarketTab, type TabId } from "@/lib/market/board";
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

export function MarketCategoryRow({
  value,
  onExchange,
}: {
  /** The chosen category: an exchange tab id, or GEM / ACCESSORY on those pages. */
  value: TabId | AuctionCategory;
  /** On /market: switch the exchange category in place. Elsewhere it opens /market with it. */
  onExchange?: (tab: TabId) => void;
}) {
  const router = useRouter();
  // The same list /market shows (its page and the auction pages prefetch it), so the row reads
  // the same on all three; until it comes, the fixed names hold the row's size.
  const tabs = useQuery({
    queryKey: ["market", "tabs"],
    queryFn: ({ signal }) => fetchMarketTabs(signal),
    staleTime: 10 * 60_000,
  });
  const live: MarketTab[] = (tabs.data?.data.tabs ?? []).filter((t) => isTabId(t.tab));
  const exchange = live.length ? live : TAB_FALLBACK;
  return (
    <PillTabs
      aria-label="시세 분류"
      value={value}
      onValueChange={(next) => {
        const auction = AUCTION_CATEGORIES.find((c) => c.value === next);
        if (auction) {
          if (auction.value !== value) router.push(auction.href);
        } else if (isTabId(String(next))) {
          const tab = String(next) as TabId;
          if (onExchange) onExchange(tab);
          else router.push(`/market?tab=${tab}`);
        }
      }}
    >
      {exchange.map((t) => (
        <PillTab key={t.tab} value={t.tab} icon={TAB_ICON[t.tab]} disabled={!live.length && !!onExchange}>
          {t.label}
        </PillTab>
      ))}
      {AUCTION_CATEGORIES.map((c) => (
        <PillTab key={c.value} value={c.value} icon={c.icon}>
          {c.label}
        </PillTab>
      ))}
    </PillTabs>
  );
}
