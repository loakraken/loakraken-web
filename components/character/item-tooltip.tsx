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
import { groupExtraLines, lineTone } from "@/lib/character/item-tooltips";
import styles from "./item-tooltip.module.css";

type Equipment = Character["loadout"]["equipment"][number];

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
      {/* "거래 불가"·"거래가능" sit on the right, as in the game's tooltip. */}
      <ItemDetailSection className={styles.tradeEnd}>
        <Line>{last}</Line>
      </ItemDetailSection>
    </>
  );
}

type Detail = NonNullable<Equipment["detail"]>;

/** Polish and bracelet lines in the official tooltip's grade colour (상·중·하). */
function Graded({ text, grade }: { text: string; grade: string | null }) {
  return (
    <ItemLine>
      <span style={grade ? ({ color: POLISH_TONE[grade] } as CSSProperties) : undefined}>{text}</span>
    </ItemLine>
  );
}

/**
 * The effect sections in the official order. The plain effect groups already
 * hold "연마 효과" and "팔찌 효과"; those two are drawn from the graded lists in
 * the same place (for the colours), never twice. The stone's "무작위 각인 효과"
 * group is kept as is — it also has the level bonus line the list lacks.
 */
function Effects({ detail: d }: { detail: Detail }) {
  const polish = d.polishEffects.length > 0;
  const bracelet = d.braceletEffects.length > 0;
  const titles = new Set(d.effects.map((group) => group.title));
  return (
    <>
      {d.effects.map((group, i) =>
        polish && group.title === "연마 효과" ? (
          <ItemDetailSection key={i} label={group.title}>
            {d.polishEffects.map((e, j) => (
              <Graded key={j} text={`${e.name} ${e.value}`} grade={e.grade} />
            ))}
          </ItemDetailSection>
        ) : bracelet && group.title === "팔찌 효과" ? (
          <ItemDetailSection key={i} label={group.title}>
            {d.braceletEffects.map((e, j) => (
              <Graded key={j} text={e.text} grade={e.grade} />
            ))}
          </ItemDetailSection>
        ) : (
          <ItemDetailSection key={i} label={group.title}>
            {group.lines.map((line, j) => (
              <ItemLine key={j}>{line}</ItemLine>
            ))}
          </ItemDetailSection>
        ),
      )}
      {/* An older parser without these groups: the lists alone, after the effects. */}
      {polish && !titles.has("연마 효과") && (
        <ItemDetailSection label="연마 효과">
          {d.polishEffects.map((e, j) => (
            <Graded key={j} text={`${e.name} ${e.value}`} grade={e.grade} />
          ))}
        </ItemDetailSection>
      )}
      {bracelet && !titles.has("팔찌 효과") && (
        <ItemDetailSection label="팔찌 효과">
          {d.braceletEffects.map((e, j) => (
            <Graded key={j} text={e.text} grade={e.grade} />
          ))}
        </ItemDetailSection>
      )}
      {d.stoneEngravings.length > 0 && !titles.has("무작위 각인 효과") && (
        <ItemDetailSection label="무작위 각인 효과">
          {d.stoneEngravings.map((e, j) => (
            <ItemLine key={j}>
              [{e.name}] Lv.{e.level}
            </ItemLine>
          ))}
        </ItemDetailSection>
      )}
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
      {d && <Effects detail={d} />}
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
      {groupExtraLines(lines).map((group, i) => (
        <ItemDetailSection key={`x${i}`}>
          {group.map((line, j) => (
            <Line key={j}>{line}</Line>
          ))}
        </ItemDetailSection>
      ))}
    </ItemDetail>
  );
}

/**
 * The item's icon opens its card, as on the reference site (sheet v2.1 §1:
 * the card hangs off the icon, 12px to its right, top 8px above): hover,
 * click or Enter on desktop, a tap on touch screens (bottom sheet).
 */
export function ItemTooltip({
  item,
  slot,
  lines,
  children,
}: {
  item: Equipment;
  slot?: string;
  /** The official tooltip's remaining lines (item-tooltips, loaded when idle). */
  lines?: string[];
  /** The icon. */
  children: ReactNode;
}) {
  const name = item.name ?? slot ?? "아이템";
  return (
    <Tooltip>
      <ItemTooltipTrigger className={styles.trigger} aria-label={`${name} 상세 보기`}>
        {children}
      </ItemTooltipTrigger>
      <ItemTooltipContent aria-label={name}>
        <EquipmentCard item={item} slot={slot} lines={lines} />
      </ItemTooltipContent>
    </Tooltip>
  );
}

/**
 * Any element that opens a detail card (gems, engravings and the rest of the
 * reference site's hover targets): the trigger hugs its children.
 */
export function DetailTooltip({
  name,
  card,
  children,
}: {
  /** What the card is about ("… 상세 보기"). */
  name: string;
  card: ReactNode;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <ItemTooltipTrigger className={styles.trigger} aria-label={`${name} 상세 보기`}>
        {children}
      </ItemTooltipTrigger>
      <ItemTooltipContent aria-label={name}>{card}</ItemTooltipContent>
    </Tooltip>
  );
}

type Gem = NonNullable<Character["loadout"]["gems"]>["items"][number];
type GemSkill = NonNullable<NonNullable<Character["loadout"]["gems"]>["effects"]>["skills"][number];

/**
 * The gem card in the reference site's order (sheet v2.1 §2c): name, icon row
 * (grade 보석, 장착중), gem level, the effect on its skill ("[직업] 스킬 …"),
 * the extra effect, then the official remaining lines (tuning notes as one
 * section, restrictions, sources).
 */
export function GemCard({
  gem,
  skill,
  className,
  lines = [],
}: {
  gem: Gem;
  skill?: GemSkill;
  /** The character's class, for "[블레이드] …" as the game writes it. */
  className: string;
  lines?: string[];
}) {
  const levelLine = lines.find((line) => /^보석 레벨/.test(line));
  const rest = lines.filter((line) => line !== levelLine);
  return (
    <ItemDetail
      grade={itemGrade(gem.grade)}
      title={gem.name ?? "보석"}
      // eslint-disable-next-line @next/next/no-img-element -- official CDN icon at a fixed size
      icon={gem.icon ? <img src={gem.icon} alt="" width={56} height={56} referrerPolicy="no-referrer" /> : undefined}
      lines={[[gem.grade, "보석"].filter(Boolean).join(" ")]}
      aside="장착중"
    >
      {levelLine ? (
        <ItemLine>{levelLine}</ItemLine>
      ) : gem.level != null ? (
        <ItemLine>보석 레벨 {gem.level}</ItemLine>
      ) : null}
      {skill && (
        <ItemDetailSection label="효과">
          {skill.description.map((text, i) => (
            <ItemLine key={i}>
              [{className}] {skill.name} {text}
            </ItemLine>
          ))}
        </ItemDetailSection>
      )}
      {skill?.option && (
        <ItemDetailSection label="추가 효과">
          <ItemLine>{skill.option}</ItemLine>
        </ItemDetailSection>
      )}
      {groupExtraLines(rest).map((group, i) => (
        <ItemDetailSection key={i}>
          {group.map((line, j) => (
            <Line key={j}>{line}</Line>
          ))}
        </ItemDetailSection>
      ))}
    </ItemDetail>
  );
}

/** The engraving card: no title or icon, the effect text only (sheet v2.1 §2c). */
export function EngravingCard({ description }: { description: string }) {
  return (
    <ItemDetail>
      <ItemLine>{description}</ItemLine>
    </ItemDetail>
  );
}
