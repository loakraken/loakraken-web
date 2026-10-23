"use client";

// 악세 경매 검색 — one listing as a game-style item card (사용자 10-16): icon
// with its grade frame, grade and slot, quality, base effect, polish effects
// (coloured by tier), the ark passive point, trade count and the auction
// (buy-now, starting bid, time left). Only values the search response already
// carries; nothing is fetched. The card parts are the shared item tooltip's
// (popover beside the row on a pointer, bottom sheet on touch).

import type { ReactNode } from "react";
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
import type { SearchItem, SearchPolish } from "@/lib/accessory-search/model";
import { timeLeftText } from "@/lib/accessory-search/time-left";
import { koreanGold } from "@/lib/spec-up/model";
import { safeGameImage } from "@/lib/character/model";
import styles from "./accessory-search.module.css";

/** icon and baseEffects come from the same official response (no extra call); an older response without them still draws. */
type Listing = SearchItem;

const kstEnd = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const polishText = (line: SearchPolish, value: (line: SearchPolish) => string) => `${line.name} ${value(line)}`.trim();

export function AccessoryCard({
  item,
  slotLabel,
  polishValue,
}: {
  item: Listing;
  slotLabel: string;
  polishValue: (line: SearchPolish) => string;
}) {
  const now = useClock(MINUTE);
  const info: ReactNode[] = [[item.grade, slotLabel].filter(Boolean).join(" ")];
  if (item.quality != null && item.quality >= 0) info.push(<ItemQuality value={item.quality} />);
  const base = item.baseEffects ?? [];
  const icon = safeGameImage(item.icon);
  return (
    <ItemDetail
      grade={itemGrade(item.grade)}
      title={item.name}
      // eslint-disable-next-line @next/next/no-img-element -- official CDN icon at a fixed size
      icon={icon ? <img src={icon} alt="" width={56} height={56} referrerPolicy="no-referrer" /> : undefined}
      lines={info}
    >
      <ItemLine>{item.tradeAllowCount == null ? "거래 횟수 정보 없음" : item.tradeAllowCount === 0 ? "거래 불가" : `거래 ${item.tradeAllowCount}회 가능`}</ItemLine>
      <ItemDetailSection label="기본 효과">
        {base.length > 0 ? (
          base.map((effect) => <ItemStat key={effect.name} label={effect.name} value={`+${effect.value.toLocaleString("ko-KR")}`} />)
        ) : item.mainStat != null ? (
          <ItemStat
            label="힘·민첩·지능"
            value={`+${item.mainStat.toLocaleString("ko-KR")}${item.mainStatRangePct == null ? "" : ` (범위 ${item.mainStatRangePct.toFixed(2)}%)`}`}
          />
        ) : (
          <ItemLine tone="muted">정보 없음</ItemLine>
        )}
      </ItemDetailSection>
      {item.polish.length > 0 && (
        <ItemDetailSection label="연마 효과">
          {item.polish.map((line, i) => (
            <GradedLine key={`${line.name}-${i}`} text={polishText(line, polishValue)} grade={line.level} />
          ))}
        </ItemDetailSection>
      )}
      {item.enlightenment != null && (
        <ItemDetailSection label="아크 패시브 포인트 효과">
          <ItemLine>깨달음 +{item.enlightenment}</ItemLine>
        </ItemDetailSection>
      )}
      <ItemDetailSection label="경매">
        <ItemStat label="즉시 구매가" value={item.buyPrice == null ? "입찰만 가능" : `${koreanGold(item.buyPrice)}G`} emphasis />
        <ItemStat label="입찰 시작가" value={item.bidStartPrice == null ? "—" : `${koreanGold(item.bidStartPrice)}G`} />
        {item.endDate && (
          <>
            {/* Time left and the end time on their own lines: together they
                squeezed the label onto two lines in the popover (capture). */}
            {now != null && <ItemStat label="남은 시간" value={timeLeftText(item.endDate, now)} />}
            <ItemLine tone="muted">{kstEnd.format(new Date(item.endDate))} 종료</ItemLine>
          </>
        )}
      </ItemDetailSection>
    </ItemDetail>
  );
}

/**
 * A row that opens its card: a transparent trigger covers the whole row
 * (click, Enter/Space; tap on touch), so the row's own text stays plain,
 * readable content and the card opens beside it (or as a bottom sheet).
 */
export function ListingDetail({
  item,
  slotLabel,
  polishValue,
}: {
  item: Listing;
  slotLabel: string;
  polishValue: (line: SearchPolish) => string;
}) {
  return (
    <ItemTooltip>
      {/* Opens on a press, not on hover: moving across a long list must not pop cards up. */}
      <ItemTooltipTrigger
        className={styles.rowCover}
        style={{ cursor: "pointer" }}
        openOnHover={false}
        aria-label={`${item.name} 상세 보기`}
      />
      <ItemTooltipContent aria-label={item.name}>
        <AccessoryCard item={item} slotLabel={slotLabel} polishValue={polishValue} />
      </ItemTooltipContent>
    </ItemTooltip>
  );
}
