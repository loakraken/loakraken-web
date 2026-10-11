"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "cn"

// Item detail (equipment, accessories, stone, bracelet, gems, cores), laid out
// as iloa's card (user 10-10 23:13/23:15: same place, same look, same lines,
// same spacing). Every number below is from the reference team's measurement
// (40 레퍼런스/작은 동작 전수표 v2.1 §1·2·2b·2d·2e).
//
// Pointer devices get a Base UI Popover beside the item, as iloa's is:
// hovering previews it, while a click, Enter/Space opens it with focus inside,
// so keyboard and screen reader users can read and scroll a long card and Esc
// returns focus to the item (#319). Touch devices (no hover, coarse pointer)
// get the same card in a bottom sheet, as iloa does at 390px.
//
// <ItemTooltip>
//   <ItemTooltipTrigger aria-label="+19 운명의 전율 머리장식 상세">…</ItemTooltipTrigger>
//   <ItemTooltipContent aria-label="+19 운명의 전율 머리장식">
//     <ItemDetail grade="ancient" title="+19 운명의 전율 머리장식" icon={<img alt="" src={api} />}
//       lines={["고대 머리 방어구", "아이템 레벨 1770 (티어 4)", <ItemQuality value={95} />]} aside="장착중">
//       <ItemLine>캐릭터 귀속됨</ItemLine>
//       <ItemDetailSection label="기본 효과"><ItemStat label="힘" value="+48,012" /></ItemDetailSection>
//       <ItemProgress label="현재 단계 재련 경험치" value={0} max={67000} />
//       <ItemLine tone="warn">분해불가</ItemLine>
//     </ItemDetail>
//   </ItemTooltipContent>
// </ItemTooltip>

type Grade = "normal" | "uncommon" | "rare" | "epic" | "legendary" | "relic" | "ancient" | "esther"

const GRADES: Grade[] = ["normal", "uncommon", "rare", "epic", "legendary", "relic", "ancient", "esther"]

// --- Popover on pointer devices, bottom sheet on touch ------------------------

const TOUCH_QUERY = "(hover: none) and (pointer: coarse)"
const subscribeTouch = (onChange: () => void) => {
  const media = window.matchMedia(TOUCH_QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}
const ModeContext = React.createContext<"popover" | "sheet">("popover")

// --- Staying below the sticky header and tab bar ----------------------------

/** Elements pinned at the top of the page (site header, a page's sticky tab
 * bar) carry data-sticky-chrome; the card never goes over them. */
const CHROME = "[data-sticky-chrome]"
const EDGE = 12

/** The bottom of the pinned chrome in the upper half of the viewport, or 0. */
function chromeBottom() {
  let bottom = 0
  for (const element of document.querySelectorAll<HTMLElement>(CHROME)) {
    const rect = element.getBoundingClientRect()
    if (rect.height > 0 && rect.bottom > bottom && rect.bottom <= window.innerHeight / 2) bottom = rect.bottom
  }
  return bottom
}

const AnchorContext = React.createContext<{
  setTrigger: (element: HTMLElement | null) => void
  top: number
}>({ setTrigger: () => {}, top: EDGE })

/**
 * While the card is open (pointer devices): keep its top below the chrome
 * (collision padding from the measured bottom, not a fixed number), and close
 * it once its item has scrolled up under the chrome — the card would point at
 * nothing (user 10-11: the open card covered the tab bar while scrolling).
 */
function useBelowChrome(open: boolean, close: () => void) {
  const trigger = React.useRef<HTMLElement | null>(null)
  const [top, setTop] = React.useState(EDGE)
  const closeRef = React.useRef(close)
  React.useEffect(() => {
    closeRef.current = close
  })
  React.useEffect(() => {
    if (!open) return
    let frame = 0
    const check = () => {
      frame = 0
      const bottom = chromeBottom()
      setTop(bottom + EDGE)
      const rect = trigger.current?.getBoundingClientRect()
      if (rect && rect.height > 0 && rect.top + rect.height / 2 < bottom) closeRef.current()
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check)
    }
    check()
    window.addEventListener("scroll", schedule, { passive: true, capture: true })
    window.addEventListener("resize", schedule, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule, { capture: true })
      window.removeEventListener("resize", schedule)
    }
  }, [open])
  const setTrigger = React.useCallback((element: HTMLElement | null) => {
    trigger.current = element
  }, [])
  return { setTrigger, top }
}

function ItemTooltip({ open, defaultOpen, onOpenChange, children, ...props }: PopoverPrimitive.Root.Props) {
  // The server and the first client render use the popover; a touch device
  // switches before anything can open, since nothing opens until a press.
  const touch = React.useSyncExternalStore(subscribeTouch, () => window.matchMedia(TOUCH_QUERY).matches, () => false)
  const [innerOpen, setInnerOpen] = React.useState(defaultOpen ?? false)
  const shown = open ?? innerOpen
  const change: NonNullable<PopoverPrimitive.Root.Props["onOpenChange"]> = (next, details) => {
    if (open === undefined) setInnerOpen(next)
    onOpenChange?.(next, details)
  }
  const anchor = useBelowChrome(!touch && shown, () => {
    if (open === undefined) setInnerOpen(false)
    onOpenChange?.(false, { reason: "none" } as never)
  })
  if (touch) {
    return (
      <ModeContext.Provider value="sheet">
        <DrawerPrimitive.Root
          open={open}
          defaultOpen={defaultOpen}
          onOpenChange={onOpenChange && ((next, details) => onOpenChange(next, details as never))}
          swipeDirection="down"
        >
          {children}
        </DrawerPrimitive.Root>
      </ModeContext.Provider>
    )
  }
  return (
    <ModeContext.Provider value="popover">
      <AnchorContext.Provider value={anchor}>
        <PopoverPrimitive.Root open={shown} onOpenChange={change} {...props}>
          {children}
        </PopoverPrimitive.Root>
      </AnchorContext.Provider>
    </ModeContext.Provider>
  )
}

/** The item itself, as a button. Hover opens 180ms after the pointer rests
 * (iloa 160–200ms) and closes 100ms after it leaves; moving onto the card
 * keeps it open. The card does not follow the pointer. On touch a tap opens
 * the sheet. */
function ItemTooltipTrigger({ className, ...props }: PopoverPrimitive.Trigger.Props) {
  const mode = React.useContext(ModeContext)
  const { setTrigger } = React.useContext(AnchorContext)
  if (mode === "sheet") {
    return (
      <DrawerPrimitive.Trigger
        data-slot="item-tooltip-trigger"
        className={cn("cursor-default", className as string)}
        {...(props as DrawerPrimitive.Trigger.Props)}
      />
    )
  }
  return (
    <PopoverPrimitive.Trigger
      data-slot="item-tooltip-trigger"
      ref={setTrigger}
      openOnHover
      delay={180}
      closeDelay={100}
      className={cn("cursor-default", className)}
      {...props}
    />
  )
}

// The glass face both shapes share: iloa's fill, blur and edge.
const FACE = "bg-(--item-tip) text-(--item-tip-foreground) shadow-(--item-tip-shadow) backdrop-blur-[24px] backdrop-saturate-[1.8]"
const SCROLL = "overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

/** Pointer: right of the item, top edges 8px apart (card higher), 12px gap;
 * flips to the left when the right has no room, and stays below the sticky
 * header and tab bar (closing once its item scrolls under them). 288px wide, 16px padding, at
 * most half the viewport tall, scrolling inside with the scrollbar hidden.
 * Touch: a sheet 7px in from the sides and bottom, a 35×4 handle above it,
 * a 60% black backdrop, 500ms up; drag down, tap outside or Esc closes. */
function ItemTooltipContent({
  className,
  side = "right",
  sideOffset = 12,
  align = "start",
  alignOffset = -8,
  children,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  const mode = React.useContext(ModeContext)
  const { top } = React.useContext(AnchorContext)
  if (mode === "sheet") {
    return (
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/60",
            "opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
            "data-starting-style:opacity-0 data-ending-style:opacity-0 data-swiping:transition-none"
          )}
        />
        {/* The viewport carries swipe-to-close and touch scroll locking. Under
            640px the sheet spans the screen minus 7px each side; wider, it is
            at most 512px, centred (reference re-measure, PM 09:37). */}
        <DrawerPrimitive.Viewport className="fixed inset-0 z-50">
        <DrawerPrimitive.Popup
          data-slot="item-tooltip"
          className={cn(
            "fixed inset-x-[7px] bottom-[7px] z-50 mx-auto flex flex-col min-[640px]:max-w-[512px]",
            "rounded-t-[24.5px] rounded-b-[10.5px]",
            FACE,
            "translate-y-(--drawer-swipe-movement-y) transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
            "data-starting-style:translate-y-[calc(100%+7px)] data-ending-style:translate-y-[calc(100%+7px)] data-swiping:transition-none",
            "outline-none focus-visible:outline-3 focus-visible:outline-(--ring)",
            className as string
          )}
          {...(props as DrawerPrimitive.Popup.Props)}
        >
          <span aria-hidden="true" className="absolute -top-3 left-1/2 h-1 w-[35px] -translate-x-1/2 rounded-full bg-white/60" />
          <div className={cn("max-h-[calc(100dvh-56px)] p-4", SCROLL)}>{children}</div>
        </DrawerPrimitive.Popup>
        </DrawerPrimitive.Viewport>
      </DrawerPrimitive.Portal>
    )
  }
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        // Below the header and a sticky tab bar (measured while open).
        collisionPadding={{ top, right: EDGE, bottom: EDGE, left: EDGE }}
        collisionAvoidance={{ side: "flip", align: "shift" }}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="item-tooltip"
          className={cn(
            "w-[min(288px,calc(100vw-24px))] max-h-[50vh] p-4",
            SCROLL,
            "rounded-[12px]",
            FACE,
            "origin-(--transform-origin)",
            // iloa: 150ms in, 100ms out on cubic-bezier(0.23, 1, 0.32, 1), from
            // 0.98 and 4px back towards the item. Reduced motion is instant
            // (global rule).
            "transition-[opacity,scale,translate] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
            "data-starting-style:scale-[0.98] data-starting-style:opacity-0",
            "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-100",
            "data-[side=right]:data-starting-style:-translate-x-1 data-[side=left]:data-starting-style:translate-x-1",
            "data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
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

// --- The card ---------------------------------------------------------------

/** The card body. A centred grade-coloured name (16/24 bold, row 32), then a
 * 56px icon on its grade gradient with up to three 12px lines (16px pitch)
 * 12px to its right — the first in the grade colour, with a narrow right
 * column — then the rest, 8px apart, with no rules between them. Every line
 * is 12px type on a 16px line. */
function ItemDetail({
  grade = "normal",
  title,
  icon,
  plainIcon = false,
  lines,
  aside,
  children,
  className,
}: {
  grade?: Grade
  /** Leave out for a body-only card (engravings). */
  title?: React.ReactNode
  /** Official API item image (decorative: alt=""), drawn over the gradient. */
  icon?: React.ReactNode
  /** Ark passive nodes and skills: the image alone, no grade box. */
  plainIcon?: boolean
  /** Beside the icon, top to bottom: grade·part, item level, ItemQuality. */
  lines?: React.ReactNode[]
  /** Right column on the first line, e.g. "장착중". */
  aside?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  const key = GRADES.includes(grade) ? grade : "normal"
  return (
    <div
      data-slot="item-detail"
      data-grade={key}
      className={cn("flex flex-col gap-2 text-[12px] leading-4 font-normal", className)}
      style={
        {
          "--item-grade": `var(--item-tip-grade-${key})`,
          "--item-icon-a": `var(--item-tip-icon-${key}-a)`,
          "--item-icon-b": `var(--item-tip-icon-${key}-b)`,
        } as React.CSSProperties
      }
    >
      {title && <p className="pb-2 text-center text-[16px] leading-6 font-bold break-keep text-(--item-grade)">{title}</p>}
      {(icon || lines?.length || aside) && (
        <div className="flex min-h-14 items-center gap-3">
          {icon && (
            <div
              className={cn(
                "size-14 shrink-0 overflow-hidden rounded-[4px] [&>img]:size-full [&>img]:object-cover",
                // iloa paints the box with the grade as a gradient (2d); the
                // official image sits on top. Its own artwork is not copied.
                !plainIcon && "bg-linear-to-br/srgb from-(--item-icon-a) to-(--item-icon-b)"
              )}
            >
              {icon}
            </div>
          )}
          {/* The right column sits on the first line only; the quality bar
              below takes the block's full width (iloa 188). */}
          <div className="grid min-w-0 flex-1 gap-1 leading-3">
            {(lines?.length ? lines : [null]).map((line, i) => (
              <div key={i} className={cn("flex min-w-0 gap-1 break-keep", i === 0 && "text-(--item-grade)")}>
                <div className="min-w-0 flex-1">{line}</div>
                {i === 0 && aside && <div className="shrink-0 text-(--item-tip-equipped)">{aside}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

const qualityTier = (value: number | null | undefined) =>
  value == null || value < 0
    ? "none"
    : value >= 100
      ? "max"
      : value >= 90
        ? "high"
        : value >= 70
          ? "good"
          : value >= 30
            ? "normal"
            : value >= 10
              ? "low"
              : "poor"

/** "품질 95" and a 145×12 bar, both in the quality tier's colour. */
function ItemQuality({ value }: { value: number | null | undefined }) {
  const tier = qualityTier(value)
  const known = value != null && value >= 0
  return (
    <div
      data-slot="item-quality"
      data-tier={tier}
      className="flex items-center gap-1"
      style={{ "--q": `var(--item-tip-quality-${tier})` } as React.CSSProperties}
    >
      <span>품질</span>
      <span className="tabular-nums text-(--q)">{known ? value : "-"}</span>
      <span aria-hidden="true" className="ml-auto h-3 w-[145px] min-w-0 shrink overflow-hidden rounded-[8px] bg-(--item-tip-track)">
        <span className="block h-full rounded-[8px] bg-(--q)" style={{ width: `${known ? Math.min(100, value) : 0}%` }} />
      </span>
    </div>
  )
}

/** A section: a sky-blue head line, then 16px lines. No rule. */
function ItemDetailSection({ label, children, className }: { label?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("grid", className)}>
      {label && <p className="text-(--item-tip-section)">{label}</p>}
      {children}
    </section>
  )
}

/** One plain line (귀속, 거래, 분해불가, [제작], 내구도); `\n` breaks it. */
function ItemLine({
  tone,
  children,
  className,
}: {
  tone?: "warn" | "craft" | "muted"
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        "break-keep whitespace-pre-line",
        tone === "warn" && "text-(--item-tip-warn)",
        tone === "craft" && "text-(--item-tip-craft)",
        tone === "muted" && "text-(--item-tip-muted)",
        className
      )}
    >
      {children}
    </p>
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

/** Refine experience: a head line, then a 12px bar 4px below with "0 / 67000" on it (row 32). */
function ItemProgress({ label, value, max }: { label: React.ReactNode; value: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <section className="grid gap-1">
      <p className="text-(--item-tip-section)">{label}</p>
      <div className="relative h-3 overflow-hidden rounded-[8px] bg-(--item-tip-track)">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 rounded-[8px] bg-(--item-tip-exp)" style={{ width: `${pct}%` }} />
        {/* Written as iloa does, without thousands separators. iloa's light
            figures drop to 2.0 over the orange, so the part over the fill is
            drawn again in dark ink (7.09), the rest stays light (6.78). */}
        <span className="relative block text-center text-[12px] leading-3 font-medium tabular-nums text-(--item-tip-exp-foreground)">
          {value} / {max}
        </span>
        <span
          aria-hidden="true"
          className="absolute inset-0 text-center text-[12px] leading-3 font-medium tabular-nums text-(--item-tip-exp-foreground-fill)"
          style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
        >
          {value} / {max}
        </span>
      </div>
    </section>
  )
}

export {
  ItemTooltip,
  ItemTooltipTrigger,
  ItemTooltipContent,
  ItemDetail,
  ItemDetailSection,
  ItemLine,
  ItemProgress,
  ItemQuality,
  ItemStat,
}
export type { Grade as ItemGrade }
