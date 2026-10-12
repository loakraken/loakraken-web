"use client";

import { Fragment, type CSSProperties, type ReactNode } from "react";
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
import {
  type SkillLines,
  groupExtraLines,
  lineTone,
  placeExtraLines,
  splitLeadingTrade,
  type ExtraLines,
  type GridGemLines,
  type GridLines,
} from "@/lib/character/item-tooltips";
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
function Effects({ detail: d, after }: { detail: Detail; after: Map<string, string[]> }) {
  const polish = d.polishEffects.length > 0;
  const bracelet = d.braceletEffects.length > 0;
  const titles = new Set(d.effects.map((group) => group.title));
  return (
    <>
      {d.effects.map((group, i) => (
        <Fragment key={i}>
          {polish && group.title === "연마 효과" ? (
            <ItemDetailSection label={group.title}>
              {d.polishEffects.map((e, j) => (
                <Graded key={j} text={`${e.name} ${e.value}`} grade={e.grade} />
              ))}
            </ItemDetailSection>
          ) : bracelet && group.title === "팔찌 효과" ? (
            <ItemDetailSection label={group.title}>
              {d.braceletEffects.map((e, j) => (
                <Graded key={j} text={e.text} grade={e.grade} />
              ))}
            </ItemDetailSection>
          ) : (
            <ItemDetailSection label={group.title}>
              {group.lines.map((line, j) => (
                <ItemLine key={j}>{line}</ItemLine>
              ))}
            </ItemDetailSection>
          )}
          <ExtraSections lines={after.get(group.title)} />
        </Fragment>
      ))}
      {/* An older parser without these groups: the lists alone, after the effects. */}
      {polish && !titles.has("연마 효과") && (
        <>
          <ItemDetailSection label="연마 효과">
            {d.polishEffects.map((e, j) => (
              <Graded key={j} text={`${e.name} ${e.value}`} grade={e.grade} />
            ))}
          </ItemDetailSection>
          <ExtraSections lines={after.get("연마 효과")} />
        </>
      )}
      {bracelet && !titles.has("팔찌 효과") && (
        <>
          <ItemDetailSection label="팔찌 효과">
            {d.braceletEffects.map((e, j) => (
              <Graded key={j} text={e.text} grade={e.grade} />
            ))}
          </ItemDetailSection>
          <ExtraSections lines={after.get("팔찌 효과")} />
        </>
      )}
      {d.stoneEngravings.length > 0 && !titles.has("무작위 각인 효과") && (
        <>
          <ItemDetailSection label="무작위 각인 효과">
            {d.stoneEngravings.map((e, j) => (
              <ItemLine key={j}>
                [{e.name}] Lv.{e.level}
              </ItemLine>
            ))}
          </ItemDetailSection>
          <ExtraSections lines={after.get("무작위 각인 효과")} />
        </>
      )}
    </>
  );
}

/** Remaining official lines in sections (see groupExtraLines). */
function ExtraSections({ lines }: { lines?: string[] }) {
  if (!lines?.length) return null;
  return groupExtraLines(lines).map((group, i) => (
    <ItemDetailSection key={`x${i}`}>
      {group.map((line, j) => (
        <Line key={j}>{line}</Line>
      ))}
    </ItemDetailSection>
  ));
}

/** Section titles the equipment card shows, for placing the remaining lines. */
function shownSections(d: Detail | null | undefined): Set<string> {
  const shown = new Set<string>();
  if (!d) return shown;
  for (const group of d.effects) shown.add(group.title);
  if (d.polishEffects.length) shown.add("연마 효과");
  if (d.braceletEffects.length) shown.add("팔찌 효과");
  if (d.stoneEngravings.length) shown.add("무작위 각인 효과");
  if (d.arkPassivePoint) shown.add("아크 패시브 포인트 효과");
  return shown;
}

/** "아이템 레벨 1640 (티어 4)", or the tier alone. */
function levelLine(itemLevel: number | null | undefined, tier: number | null | undefined) {
  if (itemLevel != null) return `아이템 레벨 ${itemLevel}${tier != null ? ` (티어 ${tier})` : ""}`;
  return tier != null ? `아이템 티어 ${tier}` : null;
}

/**
 * The equipment card in this order (sheet v2.1 §2c): name;
 * icon row (grade·part, item level, quality, 장착중); bound/trade; effects;
 * polish; bracelet; stone engravings; refine exp; ark passive point; then the
 * official tooltip's remaining lines (restrictions, crafting, durability,
 * sources) as they come — a line that followed an earlier section right after
 * it (a bracelet's "효과 부여 불가" under 팔찌 효과).
 */
export function EquipmentCard({ item, slot, extra }: { item: Equipment; slot?: string; extra?: ExtraLines }) {
  const d = item.detail;
  const gradeLine = d?.titleLine ?? [item.grade, slot ?? item.type].filter(Boolean).join(" ");
  const level = levelLine(d?.itemLevel, d?.tier);
  const { after, tail } = placeExtraLines(extra ?? { lines: [], sections: [] }, shownSections(d));
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
      {d && <Effects detail={d} after={after} />}
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
      {d?.arkPassivePoint && <ExtraSections lines={after.get("아크 패시브 포인트 효과")} />}
      <ExtraSections lines={tail} />
    </ItemDetail>
  );
}

/**
 * The item's icon opens its card (sheet v2.1 §1:
 * the card hangs off the icon, 12px to its right, top 8px above): hover,
 * click or Enter on desktop, a tap on touch screens (bottom sheet).
 */
export function ItemTooltip({
  item,
  slot,
  extra,
  children,
}: {
  item: Equipment;
  slot?: string;
  /** The official tooltip's remaining lines (item-tooltips, loaded when idle). */
  extra?: ExtraLines;
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
        <EquipmentCard item={item} slot={slot} extra={extra} />
      </ItemTooltipContent>
    </Tooltip>
  );
}

/**
 * Any element that opens a detail card (gems, engravings and the rest of the
 * hover targets): the trigger hugs its children.
 */
export function DetailTooltip({
  name,
  card,
  hit,
  children,
}: {
  /** What the card is about ("… 상세 보기"). */
  name: string;
  card: ReactNode;
  /** A larger touch target round a small icon: "row" (8px all round) or "tight" (taller only). */
  hit?: "row" | "tight";
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <ItemTooltipTrigger
        className={[styles.trigger, hit && styles[hit === "row" ? "hitRow" : "hitTight"]].filter(Boolean).join(" ")}
        aria-label={`${name} 상세 보기`}
      >
        {children}
      </ItemTooltipTrigger>
      <ItemTooltipContent aria-label={name}>{card}</ItemTooltipContent>
    </Tooltip>
  );
}

type Gem = NonNullable<Character["loadout"]["gems"]>["items"][number];
type GemSkill = NonNullable<NonNullable<Character["loadout"]["gems"]>["effects"]>["skills"][number];

/**
 * The gem card in this order (sheet v2.1 §2c): name, icon row
 * (전설 보석, item level and tier, 장착중), bound/trade, gem level, the effect on its skill ("[직업] 스킬 …"),
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
  const gemLevel = lines.find((line) => /^보석 레벨/.test(line));
  const rest = lines.filter((line) => line !== gemLevel);
  return (
    <ItemDetail
      grade={itemGrade(gem.grade)}
      title={gem.name ?? "보석"}
      // eslint-disable-next-line @next/next/no-img-element -- official CDN icon at a fixed size
      icon={gem.icon ? <img src={gem.icon} alt="" width={56} height={56} referrerPolicy="no-referrer" /> : undefined}
      lines={[gem.titleLine ?? [gem.grade, "보석"].filter(Boolean).join(" "), levelLine(gem.itemLevel, gem.tier)].filter(
        (line): line is string => line != null,
      )}
      aside="장착중"
    >
      <TradeLines lines={gem.tradeLines} />
      {gemLevel ? (
        <ItemLine>{gemLevel}</ItemLine>
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
      <ExtraSections lines={rest} />
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

type GridSlot = NonNullable<Character["loadout"]["arkGrid"]>["slots"][number];
type GridGem = GridSlot["gems"][number];

const img56 = (src: string | null | undefined) =>
  // eslint-disable-next-line @next/next/no-img-element -- official CDN icon at a fixed size
  src ? <img src={src} alt="" width={56} height={56} referrerPolicy="no-referrer" /> : undefined;

/**
 * The ark grid core card (sheet v2.1 §2c): name, icon row (grade 아크 그리드
 * 코어), bound/trade, core type, supplied willpower, the [10P]/[14P]/[17P]…
 * options (inactive ones muted), the activation conditions, then the official
 * remaining lines (분해불가, sources — backend #289).
 */
export function CoreCard({ slot, lines }: { slot: GridSlot; lines?: GridLines }) {
  const { trade, rest } = splitLeadingTrade(lines?.extraLines ?? []);
  return (
    <ItemDetail
      grade={itemGrade(slot.grade)}
      title={slot.name ?? "아크 그리드 코어"}
      icon={img56(slot.icon)}
      lines={[lines?.titleLine ?? [slot.grade, "아크 그리드 코어"].filter(Boolean).join(" ")]}
    >
      <TradeLines lines={[...(lines?.tradeLines ?? []), ...trade]} />
      {slot.coreType && (
        <ItemDetailSection label="코어 타입">
          <ItemLine>{slot.coreType}</ItemLine>
        </ItemDetailSection>
      )}
      {slot.supplyWillpower != null && (
        <ItemDetailSection label="코어 공급 의지력">
          <ItemLine>{slot.supplyWillpower} 포인트</ItemLine>
        </ItemDetailSection>
      )}
      {slot.options.length > 0 && (
        <ItemDetailSection label="코어 옵션">
          {slot.options.map((option) => (
            <ItemLine key={option.threshold} tone={option.active ? undefined : "muted"}>
              [{option.threshold}P] {option.text}
            </ItemLine>
          ))}
        </ItemDetailSection>
      )}
      {slot.conditions.length > 0 && (
        <ItemDetailSection label="코어 옵션 발동 조건">
          {slot.conditions.map((condition, i) => (
            <ItemLine key={i}>{condition}</ItemLine>
          ))}
        </ItemDetailSection>
      )}
      <ExtraSections lines={rest} />
    </ItemDetail>
  );
}

/**
 * The ark grid gem card (§2c): name, icon row (grade 아크 그리드 젬), 가공 완료 ·
 * 거래 불가, basic info (type, point), effects (willpower = base - efficiency,
 * the core point, each option with its level and value), then the official
 * sources ("[젬 가공] …", backend #289).
 */
export function GridGemCard({ gem, lines }: { gem: GridGem; lines?: GridGemLines }) {
  const type = gem.gemType ?? "젬";
  return (
    <ItemDetail
      grade={itemGrade(gem.grade)}
      title={gem.name ?? "아크 그리드 젬"}
      icon={img56(gem.icon)}
      lines={[lines?.titleLine ?? [gem.grade, "아크 그리드 젬"].filter(Boolean).join(" ")]}
      aside={gem.active === false ? undefined : "장착중"}
    >
      <TradeLines lines={lines?.tradeLines ?? []} />
      {(gem.gemType || gem.gemPoint != null) && (
        <ItemDetailSection label="젬 기본 정보">
          {gem.gemType && <ItemLine>젬 타입 : {gem.gemType}</ItemLine>}
          {gem.gemPoint != null && <ItemLine>젬 포인트 : {gem.gemPoint}</ItemLine>}
        </ItemDetailSection>
      )}
      <ItemDetailSection label="젬 효과">
        {gem.requiredWillpower != null && (
          <ItemLine>
            필요 의지력 : {gem.requiredWillpower}
            {gem.baseWillpower != null && gem.willpowerEfficiency != null
              ? ` (기본 값 ${gem.baseWillpower} – 의지력 효율 ${gem.willpowerEfficiency})`
              : ""}
          </ItemLine>
        )}
        {gem.corePoint != null && (
          <ItemLine>
            {type} 포인트 : {gem.corePoint}
          </ItemLine>
        )}
        {gem.options.map((option, i) => (
          <div key={i}>
            <ItemLine>
              [{option.name}]{option.level != null ? ` Lv.${option.level}` : ""}
            </ItemLine>
            {option.effect && <ItemLine>{option.effect}</ItemLine>}
          </div>
        ))}
      </ItemDetailSection>
      <ExtraSections lines={lines?.extraLines} />
    </ItemDetail>
  );
}

/**
 * An ark passive node card (§2c): title = node, the image without a grade
 * box, "트리 / 아크 패시브 레벨 N", then the effect text.
 */
export function PassiveNodeCard({
  name,
  tree,
  level,
  icon,
  text,
}: {
  name: string;
  tree: string;
  level: number | null;
  icon: string | null;
  text: string | null;
}) {
  return (
    <ItemDetail
      title={name}
      icon={img56(icon)}
      plainIcon
      lines={[tree, level != null ? `아크 패시브 레벨 ${level}` : null].filter((line): line is string => line != null)}
    >
      {text && <ItemLine>{text}</ItemLine>}
    </ItemDetail>
  );
}

type Skill = Character["loadout"]["skills"][number];
type Rune = NonNullable<Skill["rune"]>;

const ATTACK_TYPE: Record<string, string> = { BACK_ATTACK: "백 어택", HEAD_ATTACK: "헤드 어택" };

/**
 * The skill card (sheet v2.1 §2c): title = skill name, the image without a
 * grade box, type and skill level, attack info (part break, counter, attack
 * type), the chosen tripods (28px icon, name, effect), then the rune and gem
 * effects. With the official tooltip lines (backend #300) the icon row is
 * "일반 / 재사용 대기시간 5초 / [일반 스킬]" and the info is the game's own
 * lines (PvE, skill level, mana, part break, stagger, attack type, super armor).
 */
export function SkillDetailCard({ skill, lines }: { skill: Skill; lines?: SkillLines }) {
  const official = lines?.infoLines.length ? lines.infoLines : null;
  const attack = [
    skill.partBreakLevel != null ? `부위 파괴 : 레벨 ${skill.partBreakLevel}` : null,
    skill.counter ? "카운터 : 가능" : null,
    skill.attackType && ATTACK_TYPE[skill.attackType] ? `공격 타입 : ${ATTACK_TYPE[skill.attackType]}` : null,
  ].filter((line): line is string => line != null);
  return (
    <ItemDetail
      title={skill.name ?? "스킬"}
      icon={img56(skill.icon)}
      plainIcon
      lines={
        lines?.titleLines.length
          ? lines.titleLines
          : [skill.type, skill.level != null ? `스킬 레벨 ${skill.level}` : null].filter(
              (line): line is string => line != null,
            )
      }
    >
      {official && (
        <ItemDetailSection>
          {official.map((line, i) => (
            <ItemLine key={i}>{line}</ItemLine>
          ))}
        </ItemDetailSection>
      )}
      {!official && attack.length > 0 && (
        <ItemDetailSection>
          {attack.map((line) => (
            <ItemLine key={line}>{line}</ItemLine>
          ))}
        </ItemDetailSection>
      )}
      {skill.tripods.length > 0 && (
        <ItemDetailSection label="트라이포드">
          {skill.tripods.map((tripod, i) => (
            <div key={i} className={styles.tripod}>
              {/* eslint-disable-next-line @next/next/no-img-element -- official CDN icon at a fixed size */}
              {tripod.icon ? <img src={tripod.icon} alt="" width={28} height={28} referrerPolicy="no-referrer" /> : <span />}
              <div>
                <ItemLine>{tripod.name ?? "-"}</ItemLine>
                {tripod.effect && <ItemLine tone="muted">{tripod.effect}</ItemLine>}
              </div>
            </div>
          ))}
        </ItemDetailSection>
      )}
      {skill.rune?.effect && (
        <ItemDetailSection label="스킬 룬 효과">
          <ItemLine>
            [{skill.rune.name}] {skill.rune.effect}
          </ItemLine>
        </ItemDetailSection>
      )}
      {skill.gemEffects.length > 0 && (
        <ItemDetailSection label="보석 효과">
          {skill.gemEffects.map((effect, i) => (
            <ItemLine key={i}>{effect.text}</ItemLine>
          ))}
        </ItemDetailSection>
      )}
    </ItemDetail>
  );
}

/**
 * The skill rune card (§2c): name, icon row (전설 스킬 룬), the effect, then the
 * official remaining lines (description, sources).
 */
export function RuneCard({ rune, lines = [] }: { rune: Rune; lines?: string[] }) {
  return (
    <ItemDetail
      grade={itemGrade(rune.grade)}
      title={rune.name ?? "스킬 룬"}
      icon={img56(rune.icon)}
      lines={[[rune.grade, "스킬 룬"].filter(Boolean).join(" ")]}
    >
      {rune.effect && <ItemLine>{rune.effect}</ItemLine>}
      <ExtraSections lines={lines} />
    </ItemDetail>
  );
}

type Avatar = Character["avatars"][number];

/**
 * The avatar card (sheet v2.1 §2c): name, icon row (grade and type, 장착중),
 * the 덧입기 note (its effects do not apply), then the base effect. Bound/trade,
 * tendencies and sources come when the backend sends the tooltip lines.
 */
export function AvatarCard({ avatar }: { avatar: Avatar }) {
  return (
    <ItemDetail
      grade={itemGrade(avatar.grade)}
      title={avatar.name ?? "아바타"}
      icon={img56(avatar.icon)}
      // The type already reads "무기 아바타", "이동 효과"; the official line
      // ("영웅 검 아바타") comes with the backend tooltip lines.
      lines={[[avatar.grade, avatar.type ?? "아바타"].filter(Boolean).join(" ")]}
      aside="장착중"
    >
      {avatar.isInner && (
        <ItemLine tone="muted">아래 능력들이 적용되지 않는 상태입니다.(덧입기 슬롯에 착용 중)</ItemLine>
      )}
      {avatar.effects.length > 0 && (
        <ItemDetailSection label="기본 효과">
          {avatar.effects.map((effect, i) => (
            <ItemLine key={i}>{effect}</ItemLine>
          ))}
        </ItemDetailSection>
      )}
    </ItemDetail>
  );
}
