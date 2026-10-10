"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "cn"

// Item detail on hover (equipment, gems, cards, accessories), as the target
// sites show it: a dark game-style card in both themes with a grade-coloured
// title, ruled sections and emphasised numbers.
//
// Built on Base UI Popover rather than Tooltip (#319, frontend-a11y check):
// hovering previews it, while a click, Enter/Space or a tap opens it with
// focus inside, so keyboard and screen reader users can read and scroll a
// long card and Esc returns focus to the item. A plain tooltip opens on focus
// but is never announced and cannot be scrolled from the keyboard.
//
// <ItemTooltip>
//   <ItemTooltipTrigger aria-label="머리 방어구 +19 운명의 결단 상세">…</ItemTooltipTrigger>
//   <ItemTooltipContent aria-label="+19 운명의 결단 머리">
//     <ItemDetail grade="ancient" title="+19 운명의 결단 머리" subtitle="고대 머리 방어구" icon={<img alt="" … />}>
//       <ItemDetailSection label="기본 효과"><ItemStat label="힘" value="+48,012" /></ItemDetailSection>
//     </ItemDetail>
//   </ItemTooltipContent>
// </ItemTooltip>

type Grade = "normal" | "uncommon" | "rare" | "epic" | "legendary" | "relic" | "ancient" | "esther"

const GRADE_TEXT: Record<Grade, string> = {
  normal: "text-(--item-tip-grade-normal)",
  uncommon: "text-(--item-tip-grade-uncommon)",
  rare: "text-(--item-tip-grade-rare)",
  epic: "text-(--item-tip-grade-epic)",
  legendary: "text-(--item-tip-grade-legendary)",
  relic: "text-(--item-tip-grade-relic)",
  ancient: "text-(--item-tip-grade-ancient)",
  esther: "text-(--item-tip-grade-esther)",
}

function ItemTooltip(props: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root {...props} />
}

/** The item itself, as a button. Hover opens after 150ms (closes 100ms after leaving). */
function ItemTooltipTrigger({ className, ...props }: PopoverPrimitive.Trigger.Props) {
  return (
    <PopoverPrimitive.Trigger
      data-slot="item-tooltip-trigger"
      openOnHover
      delay={150}
      closeDelay={100}
      className={cn("cursor-default", className)}
      {...props}
    />
  )
}

/** The positioned card. Flips and shifts to stay 8px inside the viewport; a long body scrolls inside it. */
function ItemTooltipContent({
  className,
  side = "right",
  sideOffset = 8,
  align = "start",
  children,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, "align" | "side" | "sideOffset">) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        collisionPadding={8}
        collisionAvoidance={{ side: "flip", align: "shift" }}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="item-tooltip"
          className={cn(
            "w-[min(320px,calc(100vw-16px))] max-h-[min(480px,calc(100dvh-16px))] overflow-y-auto overscroll-contain",
            "rounded-(--radius-md) bg-(--item-tip) text-(--item-tip-foreground) shadow-(--tooltip-shadow)",
            "origin-(--transform-origin)",
            // 140ms fade with a 4px lift; reduced motion is instant (global rule).
            "transition-[opacity,translate] duration-[140ms] ease-(--ease-out)",
            "data-starting-style:translate-y-1 data-starting-style:opacity-0",
            "data-ending-style:opacity-0 data-ending-style:duration-[100ms]",
            "data-instant:transition-none",
            // Focus lands on the card itself when opened by click or keyboard.
            "outline-none focus-visible:outline-3 focus-visible:outline-(--ring)",
            className
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

/** The card body: icon + grade-coloured title row, then sections. */
function ItemDetail({
  grade = "normal",
  title,
  subtitle,
  icon,
  aside,
  children,
  className,
}: {
  grade?: Grade
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Icon from the official API image URL (decorative: alt=""). */
  icon?: React.ReactNode
  /** Right side of the title row, e.g. a QualityBadge. */
  aside?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div data-slot="item-detail" className={cn("grid text-(length:--text-caption) leading-[1.45]", className)}>
      <div className="flex items-start gap-3 px-3.5 pt-3 pb-2.5">
        {icon && <div className="size-10 shrink-0 overflow-hidden rounded-(--radius-xs) [&>img]:size-full">{icon}</div>}
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className={cn("text-(length:--text-body) leading-[1.3] font-semibold break-keep", GRADE_TEXT[grade])}>{title}</p>
          {subtitle && <p className="text-(--item-tip-muted)">{subtitle}</p>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {children}
    </div>
  )
}

/** A ruled section with a muted label. */
function ItemDetailSection({ label, children, className }: { label?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("grid gap-1 border-t border-(--item-tip-rule) px-3.5 py-2.5", className)}>
      {label && <p className="text-(--item-tip-muted) font-medium">{label}</p>}
      {children}
    </section>
  )
}

/** One stat line: label left, value right in tabular figures. `tone` colours a change. */
function ItemStat({
  label,
  value,
  tone,
  emphasis = false,
}: {
  label: React.ReactNode
  value: React.ReactNode
  tone?: "up" | "down"
  emphasis?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 break-keep">{label}</span>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          emphasis && "font-semibold",
          tone === "up" && "text-(--item-tip-up)",
          tone === "down" && "text-(--item-tip-down)"
        )}
      >
        {value}
      </span>
    </div>
  )
}

export { ItemTooltip, ItemTooltipTrigger, ItemTooltipContent, ItemDetail, ItemDetailSection, ItemStat }
export type { Grade as ItemGrade }
