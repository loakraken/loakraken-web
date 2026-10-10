"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  ItemDetail,
  ItemDetailSection,
  ItemLine,
  ItemProgress,
  ItemQuality,
  ItemTooltip as Tooltip,
  ItemTooltipContent,
  ItemTooltipTrigger,
  type ItemGrade,
} from "@/components/ui/item-tooltip";
import { gradeKey } from "@/lib/character/model";
import type { Character } from "@/lib/character/model";
import { lineTone } from "@/lib/character/item-tooltips";

type Equipment = Character["loadout"]["equipment"][number];

const POLISH: Record<string, string> = { HIGH: "상", MID: "중", LOW: "하" };
const POLISH_TONE: Record<string, string> = { HIGH: "#ffb37a", MID: "#d3a6ff", LOW: "#8cc4ff" };
const GRADES = new Set(["normal", "uncommon", "rare", "epic", "legendary", "relic", "ancient", "esther"]);

/** The item's grade as the card part knows it (unknown grades draw as 일반). */
export const itemGrade = (grade: string | null | undefined): ItemGrade => {
  const key = gradeKey(grade);
  return (GRADES.has(key) ? key : "normal") as ItemGrade;
};

/** One official line in its colour: restrictions red, "[제작] …" cyan. */
function Line({ children }: { children: string }) {
  const tone = lineTone(children);
  return <ItemLine tone={tone === "plain" ? undefined : tone}>{children}</ItemLine>;
}

/**
 * Bound/trade lines. The official tooltip has two boxes — bound and trade
 * limits, then whether it trades — so the last line is its own section
 * (reference sheet v2.1 §2c: "캐릭터 귀속됨 · 거래 불가", "거래 제한 … / 캐릭터
 * 귀속됨 / 거래 2회 가능 · 거래가능").
 */
function TradeLines({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  const last = lines[lines.length - 1];
  return (
    <>
      {lines.length > 1 && (
        <ItemDetailSection>
          {lines.slice(0, -1).map((line, i) => (
            <Line key={i}>{line}</Line>
          ))}
        </ItemDetailSection>
      )}
      <ItemDetailSection>
        <Line>{last}</Line>
      </ItemDetailSection>
    </>
  );
}

/**
 * The equipment card in the reference site's order (sheet v2.1 §2c): name;
 * icon row (grade·part, item level, quality, 장착중); bound/trade; effects;
 * polish; bracelet; stone engravings; refine exp; ark passive point; then the
 * official tooltip's remaining lines (restrictions, crafting, durability,
 * sources) as they come.
 */
export function EquipmentCard({ item, slot, lines = [] }: { item: Equipment; slot?: string; lines?: string[] }) {
  const d = item.detail;
  const gradeLine = d?.titleLine ?? [item.grade, slot ?? item.type].filter(Boolean).join(" ");
  const level =
    d?.itemLevel != null
      ? `아이템 레벨 ${d.itemLevel}${d.tier != null ? ` (티어 ${d.tier})` : ""}`
      : d?.tier != null
        ? `아이템 티어 ${d.tier}`
        : null;
  const quality = d?.quality != null && d.quality >= 0 ? d.quality : null;
  const info: ReactNode[] = [gradeLine];
  if (level) info.push(level);
  if (quality != null) info.push(<ItemQuality value={quality} />);
  return (
    <ItemDetail
      grade={itemGrade(item.grade)}
      title={item.name ?? slot ?? "-"}
      // eslint-disable-next-line @next/next/no-img-element -- official CDN icon at a fixed size
      icon={item.icon ? <img src={item.icon} alt="" width={56} height={56} referrerPolicy="no-referrer" /> : undefined}
      lines={info}
      aside="장착중"
    >
      {d && <TradeLines lines={d.tradeLines} />}
      {d?.advancedRefineLevel ? <ItemLine>[상급 재련] {d.advancedRefineLevel}단계</ItemLine> : null}
      {d?.effects.map((group, i) => (
        <ItemDetailSection key={i} label={group.title}>
          {group.lines.map((line, j) => (
            <ItemLine key={j}>{line}</ItemLine>
          ))}
        </ItemDetailSection>
      ))}
      {d?.polishEffects.length ? (
        <ItemDetailSection label="연마 효과">
          {d.polishEffects.map((e, i) => (
            <p key={i} style={e.grade ? ({ color: POLISH_TONE[e.grade] } as CSSProperties) : undefined}>
              {e.grade && <b>{POLISH[e.grade] ?? ""} </b>}
              {e.name} {e.value}
            </p>
          ))}
        </ItemDetailSection>
      ) : null}
      {d?.braceletEffects.length ? (
        <ItemDetailSection label="팔찌 효과">
          {d.braceletEffects.map((e, i) => (
            <ItemLine key={i}>
              <span style={e.grade ? ({ color: POLISH_TONE[e.grade] } as CSSProperties) : undefined}>{e.text}</span>
            </ItemLine>
          ))}
        </ItemDetailSection>
      ) : null}
      {d?.stoneEngravings.length ? (
        <ItemDetailSection label="무작위 각인 효과">
          {d.stoneEngravings.map((e, i) => (
            <ItemLine key={i}>
              [{e.name}] Lv.{e.level}
            </ItemLine>
          ))}
        </ItemDetailSection>
      ) : null}
      {d?.refineExp && (
        <ItemProgress label="현재 단계 재련 경험치" value={d.refineExp.current ?? 0} max={d.refineExp.max} />
      )}
      {d?.arkPassivePoint && (
        <ItemDetailSection label="아크 패시브 포인트 효과">
          <ItemLine>
            {d.arkPassivePoint.name} +{d.arkPassivePoint.value}
          </ItemLine>
        </ItemDetailSection>
      )}
      {lines.map((line, i) => (
        <Line key={`x${i}`}>{line}</Line>
      ))}
    </ItemDetail>
  );
}

/**
 * An equipment row that opens its card: hover, click or Enter on desktop
 * (beside the row, the reference site's place and timing), a tap on touch
 * screens (bottom sheet). The row itself is the trigger.
 */
export function ItemTooltip({
  item,
  slot,
  lines,
  as = "li",
  className,
  style,
  wide,
  children,
}: {
  item: Equipment;
  slot?: string;
  /** The official tooltip's remaining lines (item-tooltips, loaded when idle). */
  lines?: string[];
  as?: "li" | "div";
  className?: string;
  style?: CSSProperties;
  /** The bracelet row spans two columns (data-wide). */
  wide?: boolean;
  children: ReactNode;
}) {
  const Tag = as;
  const name = item.name ?? slot ?? "아이템";
  return (
    <Tooltip>
      <ItemTooltipTrigger
        nativeButton={false}
        render={<Tag className={className} style={style} data-wide={wide ? "" : undefined} />}
        aria-label={`${name} 상세 보기`}
      >
        {children}
      </ItemTooltipTrigger>
      <ItemTooltipContent aria-label={name}>
        <EquipmentCard item={item} slot={slot} lines={lines} />
      </ItemTooltipContent>
    </Tooltip>
  );
}
