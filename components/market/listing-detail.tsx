"use client";

// 보석·장신구 시세판 — one auction listing as a game-style item card (v0.3.2,
// user request): the same card parts as 악세 경매 검색's rows (web #903),
// opened from the listing's name. Everything shown is already in the listings
// answer; opening a card asks for nothing. While a card is open the board
// keeps the list it was opened from (the 1-minute refresh does not redraw the
// rows under it), and says so on the card when that listing has since gone.

import { useEffect, useRef, type ReactNode } from "react";
import {
  ItemDetail,
  ItemDetailSection,
  ItemLine,
  ItemQuality,
  ItemStat,
  ItemTooltip,
  ItemTooltipContent,
  ItemTooltipTrigger,
} from "@/components/ui/item-tooltip";
import { GradedLine, itemGrade } from "@/components/character/item-tooltip";
import { MINUTE, useClock } from "@/components/home/clock";
import { timeLeftText } from "@/lib/accessory-search/time-left";
import { koreanGold } from "@/lib/spec-up/model";
import { safeGameImage } from "@/lib/character/model";
import type { GemListing } from "@/lib/market/auction-gems";
import styles from "./listing-detail.module.css";

type Listing = GemListing;
type Option = Listing["options"][number];

const kst = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** One listing among a page's (the answer has no id): every value it shows. */
export function listingKey(item: Listing) {
  return JSON.stringify([item.name, item.grade, item.quality, item.buyPrice, item.bidStartPrice, item.endDate, item.tradeAllowCount, item.options]);
}

const amount = (option: Option) =>
  option.value == null ? "" : ` +${option.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}${option.percentage ? "%" : ""}`;

function ListingCard({
  item,
  kind,
  observedAt,
  gone,
}: {
  item: Listing;
  /** "보석", or the accessory's slot name ("목걸이"). */
  kind: string;
  observedAt: string | null;
  gone: boolean;
}) {
  const now = useClock(MINUTE);
  const info: ReactNode[] = [[item.grade, kind].filter(Boolean).join(" ")];
  if (item.quality != null && item.quality >= 0) info.push(<ItemQuality value={item.quality} />);
  // Only an official address; none when the backend sends no icon (one from before it).
  const icon = safeGameImage(item.icon);
  // Gem effects name their class; polish lines carry a tier; the rest are plain effects.
  const gem = item.options.filter((o) => o.className);
  const polish = item.options.filter((o) => !o.className && o.level);
  const other = item.options.filter((o) => !o.className && !o.level);
  return (
    <ItemDetail
      grade={itemGrade(item.grade)}
      title={item.name}
      // eslint-disable-next-line @next/next/no-img-element -- official CDN icon at a fixed size
      icon={icon ? <img src={icon} alt="" width={56} height={56} referrerPolicy="no-referrer" /> : undefined}
      lines={info}
    >
      {gone && <ItemLine tone="warn">이 매물은 더 이상 없어요.</ItemLine>}
      <ItemLine>{item.tradeAllowCount == null ? "거래 횟수 정보 없음" : item.tradeAllowCount === 0 ? "거래 불가" : `거래 ${item.tradeAllowCount}회 가능`}</ItemLine>
      {gem.length > 0 && (
        <ItemDetailSection label="보석 효과">
          {gem.map((o, i) => (
            <ItemLine key={`${o.name}-${i}`}>
              [{o.className}] {o.name}
              {amount(o)}
            </ItemLine>
          ))}
        </ItemDetailSection>
      )}
      {polish.length > 0 && (
        <ItemDetailSection label="연마 효과">
          {polish.map((o, i) => (
            <GradedLine key={`${o.name}-${i}`} text={`${o.name}${amount(o)}`} grade={o.level} />
          ))}
        </ItemDetailSection>
      )}
      {other.length > 0 && (
        <ItemDetailSection label="그 밖의 효과">
          {other.map((o, i) => (
            <ItemLine key={`${o.name}-${i}`}>
              {o.name}
              {amount(o)}
            </ItemLine>
          ))}
        </ItemDetailSection>
      )}
      <ItemDetailSection label="경매">
        <ItemStat label="즉시 구매가" value={item.buyPrice ? `${koreanGold(item.buyPrice)}G` : "입찰만 가능"} emphasis />
        <ItemStat label="입찰 시작가" value={item.bidStartPrice == null ? "—" : `${koreanGold(item.bidStartPrice)}G`} />
        {item.endDate && (
          <>
            {now != null && <ItemStat label="남은 시간" value={timeLeftText(item.endDate, now)} />}
            <ItemLine tone="muted">{kst.format(new Date(item.endDate))} 종료</ItemLine>
          </>
        )}
        {observedAt && <ItemLine tone="muted">{kst.format(new Date(observedAt))} 기준 매물</ItemLine>}
      </ItemDetailSection>
    </ItemDetail>
  );
}

const KEEP_FOCUS = new Set<string>(["escape-key", "close-press", "trigger-press"]);

/**
 * Puts focus back on a listing's name after its card closes (`keepFocus`),
 * also when closing draws the rows again because a newer page came while it
 * was open, so the name it opened from is gone; then the same listing's new
 * name takes it, or the first name when that listing is no longer listed.
 */
export function useListingRefocus(items: Listing[] | undefined) {
  const pending = useRef<string | null>(null);
  const body = useRef<HTMLTableSectionElement>(null);
  // After every commit: the one following a close finds the rows as drawn now.
  useEffect(() => {
    const key = pending.current;
    if (!key) return;
    pending.current = null;
    const names = body.current?.querySelectorAll<HTMLElement>("th button");
    const at = items?.findIndex((item) => listingKey(item) === key) ?? -1;
    (names?.[at] ?? names?.[0])?.focus({ preventScroll: true });
  });
  return {
    body,
    refocus: (key: string | null) => {
      pending.current = key;
    },
  };
}

/**
 * The listing's name, as the button that opens its card (a press, never a
 * hover: moving down a long list must not pop cards up). On a pointer the card
 * sits beside the row; on touch it is a bottom sheet. Esc closes it and puts
 * focus back on the name. Its name is the row's own text, so the row header
 * reads the same; the trigger says it opens a dialog (aria-haspopup).
 */
export function ListingName({
  item,
  label,
  kind,
  observedAt,
  gone,
  onOpenChange,
}: {
  item: Listing;
  /** What the row shows for it (a gem's target skill, an accessory's name). */
  label: string;
  kind: string;
  observedAt: string | null;
  gone: boolean;
  /** `keepFocus`: closed from the keyboard, its close button or the name itself. */
  onOpenChange: (open: boolean, keepFocus: boolean) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <ItemTooltip
      onOpenChange={(open, details) => {
        const keepFocus = !open && KEEP_FOCUS.has(details.reason);
        // Right away, not after the sheet's closing slide.
        if (keepFocus) trigger.current?.focus({ preventScroll: true });
        onOpenChange(open, keepFocus);
      }}
    >
      <ItemTooltipTrigger ref={trigger} className={styles.name} openOnHover={false}>
        {label}
      </ItemTooltipTrigger>
      <ItemTooltipContent aria-label={`${item.name} 상세`}>
        <ListingCard item={item} kind={kind} observedAt={observedAt} gone={gone} />
      </ItemTooltipContent>
    </ItemTooltip>
  );
}
