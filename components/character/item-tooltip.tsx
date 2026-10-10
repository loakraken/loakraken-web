"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { qualityTier } from "@/lib/character/detail";
import { gradeKey } from "@/lib/character/model";
import type { Character } from "@/lib/character/model";
import styles from "./item-tooltip.module.css";

type Equipment = Character["loadout"]["equipment"][number];

const POLISH: Record<string, string> = { HIGH: "상", MID: "중", LOW: "하" };

/** The card itself: the official tooltip's lines, in the game's order. */
function Card({ item, slot }: { item: Equipment; slot?: string }) {
  const d = item.detail;
  const key = gradeKey(item.grade);
  return (
    <div className={styles.card} style={{ "--grade": `var(--grade-${key}-a, var(--tooltip-foreground))` } as CSSProperties}>
      <header className={styles.head}>
        <strong>{item.name ?? slot ?? "-"}</strong>
        <span>{[item.grade, slot ?? item.type].filter(Boolean).join(" ")}</span>
      </header>
      {d?.itemLevel != null && (
        <p className={styles.level}>
          아이템 레벨 {d.itemLevel}
          {d.tier != null && ` (티어 ${d.tier})`}
          {d.refineLevel != null && d.refineLevel > 0 && <b> · +{d.refineLevel}</b>}
        </p>
      )}
      {d?.quality != null && d.quality >= 0 && (
        <div className={styles.quality} data-tier={qualityTier(d.quality)}>
          <span>품질 {d.quality}</span>
          <i aria-hidden="true">
            <b style={{ width: `${Math.max(0, Math.min(100, d.quality))}%` }} />
          </i>
        </div>
      )}
      {d?.arkPassivePoint && (
        <p className={styles.point}>
          {d.arkPassivePoint.name} +{d.arkPassivePoint.value}
        </p>
      )}
      {d?.polishEffects.length ? (
        <section className={styles.group}>
          <h4>연마 효과</h4>
          <ul>
            {d.polishEffects.map((e, i) => (
              <li key={i} data-grade={e.grade ?? undefined}>
                {e.grade && <em>{POLISH[e.grade] ?? ""}</em>}
                {e.name} {e.value}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {d?.stoneEngravings.length ? (
        <section className={styles.group}>
          <h4>무작위 각인 효과</h4>
          <ul>
            {d.stoneEngravings.map((e, i) => (
              <li key={i}>
                [{e.name}] Lv.{e.level}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {d?.braceletEffects.length ? (
        <section className={styles.group}>
          <h4>팔찌 효과</h4>
          <ul>
            {d.braceletEffects.map((e, i) => (
              <li key={i} data-grade={e.grade ?? undefined} className={styles.pre}>
                {e.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {d?.effects.map((group, i) => (
        <section key={i} className={styles.group}>
          <h4>{group.title}</h4>
          <ul>
            {group.lines.map((line, j) => (
              <li key={j} className={styles.pre}>
                {line}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Item details on hover, keyboard focus or tap (target sites: hovering an
 * item shows its in-game tooltip; user 10-56). The row itself is the trigger,
 * so the whole item answers the pointer; Esc or a tap outside closes it. The
 * card renders only while open and stays inside the viewport.
 */
export function ItemTooltip({
  item,
  slot,
  as = "li",
  className,
  style,
  wide,
  children,
}: {
  item: Equipment;
  slot?: string;
  as?: "li" | "div";
  className?: string;
  style?: CSSProperties;
  /** The bracelet row spans two columns (data-wide). */
  wide?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const Tag = as;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        nativeButton={false}
        openOnHover
        delay={0}
        closeDelay={0}
        render={<Tag className={className} style={style} data-wide={wide ? "" : undefined} />}
        aria-label={`${item.name ?? slot ?? "아이템"} 상세 보기`}
        // Keyboard focus opens it; a tap focuses too, but its click already toggles.
        onFocus={(event) => event.currentTarget.matches(":focus-visible") && setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="right" align="start" sideOffset={8} collisionPadding={12} className={styles.positioner}>
          <Popover.Popup className={styles.popup}>
            <Card item={item} slot={slot} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
