"use client";

// 보석·장신구 시세판 — one auction listing's details, opened by the arrow on
// its row and shown right below that row (the ark grid's expand pattern, user
// 10-24): icon with its grade frame, grade and kind, quality, trade count,
// effects and the auction. Everything shown is already in the listings
// answer; opening a row asks for nothing. Several rows may be open at once.

import { useState, type ReactNode } from "react";
import { ChevronDown } from "@/components/ui/icons";
import { ItemDetail, ItemDetailSection, ItemLine, ItemQuality, ItemStat } from "@/components/ui/item-tooltip";
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

/** The listing as a game-style item card (the same parts as the item tooltips). */
export function ListingCard({
  item,
  kind,
  observedAt,
}: {
  item: Listing;
  /** "보석", or the accessory's slot name ("목걸이"). */
  kind: string;
  observedAt: string | null;
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

/** Which rows are open (by listingKey); several at once, like the ark grid's cores. */
export function useOpenRows() {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string) =>
    setOpen((now) => {
      const next = new Set(now);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  return { isOpen: (key: string) => open.has(key), toggle };
}

/**
 * The listing's name as the button that opens its details below the row: the
 * row's own text with an arrow at its end that turns over when open. The row
 * header reads the same name; the button says whether it is open.
 */
export function RowExpander({
  label,
  open,
  controls,
  onToggle,
}: {
  label: string;
  open: boolean;
  /** The id of the details row it opens. */
  controls: string;
  onToggle: () => void;
}) {
  return (
    <button type="button" className={styles.name} aria-expanded={open} aria-controls={controls} onClick={onToggle}>
      <span>{label}</span>
      <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
    </button>
  );
}

/** The details right below a list row (the accessory search's cards). */
export function DetailPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className={`${styles.detail} ${styles.panel}`}>
      {children}
    </div>
  );
}

/** The details row right below its listing's row, across every column. */
export function DetailRow({ id, columns, children }: { id: string; columns: number; children: ReactNode }) {
  return (
    <tr id={id} className={styles.detailRow}>
      <td colSpan={columns}>
        <div className={styles.detail}>{children}</div>
      </td>
    </tr>
  );
}
