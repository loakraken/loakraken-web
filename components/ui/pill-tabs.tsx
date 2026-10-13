"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "cn"

// Category tabs, Apple style (apple-design: response, spatial continuity,
// springs, scroll edge effects). One row of icon + label that never wraps; a
// single pill slides under the chosen tab on Apple's default spring (damping
// 1.0, response 0.35s), re-targeting from wherever it is if pressed again
// mid-way. When the row is wider than its box it scrolls sideways, the ends
// fade where more tabs wait, and the chosen tab is brought into view.
//
// The pill is two layers spanning the list (ring, then face), each cut to the
// active tab with clip-path from Base UI's --active-tab-* variables: moving
// it repaints only those layers, with no layout and no width animation
// (performance rule).
//
// <PillTabs value={tab} onValueChange={setTab} aria-label="시세 분류">
//   <PillTab value="REFINING" icon={<Diamonds />}>재련 재료</PillTab>
//   …
// </PillTabs>
// <PillTabsPanel value={tab}>…</PillTabsPanel>   (inside the same Root via `panels`)

type PillTabsProps = Omit<TabsPrimitive.Root.Props, "children"> & {
  /** Names the tab list (aria-label on role="tablist"). */
  "aria-label"?: string
  /** The PillTab items. */
  children: React.ReactNode
  /** Content under the row; wrap each view in PillTabsPanel. */
  panels?: React.ReactNode
  listClassName?: string
}

function PillTabs({ className, listClassName, children, panels, "aria-label": label, ...props }: PillTabsProps) {
  // The row scrolls; the tab list inside it is exactly as wide as its tabs, so
  // the pill layer (inset-0 on the list) and Base UI's --active-tab-* agree
  // without the layer widening what scrolls.
  const scroller = React.useRef<HTMLDivElement>(null)
  const [edges, setEdges] = React.useState({ start: false, end: false })

  // Keep the chosen tab inside the row (scrolls the row only, never the page).
  const reveal = React.useCallback((behavior: ScrollBehavior) => {
    const el = scroller.current
    const tab = el?.querySelector<HTMLElement>("[data-slot=pill-tab][data-active]")
    if (!el || !tab) return
    const pad = 28
    const left = tab.offsetLeft - pad
    const right = tab.offsetLeft + tab.offsetWidth + pad - el.clientWidth
    if (left < el.scrollLeft) el.scrollTo({ left, behavior })
    else if (right > el.scrollLeft) el.scrollTo({ left: right, behavior })
  }, [])

  // Fades only where tabs are hidden: read after layout, on scroll and resize.
  // A row that narrows (rotation, a smaller window) brings the chosen tab back.
  React.useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    let width = el.clientWidth
    const read = () => {
      const start = el.scrollLeft > 1
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
    }
    const resized = () => {
      if (el.clientWidth !== width) {
        width = el.clientWidth
        reveal("instant")
      }
      read()
    }
    read()
    const observer = new ResizeObserver(resized)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    el.addEventListener("scroll", read, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener("scroll", read)
    }
  }, [reveal])

  // On a new choice. Base UI marks the active tab after its own effect, so look
  // a frame later. The first time (a deep link to a later tab) it jumps; after
  // that it glides.
  const { value } = props
  const shown = React.useRef(false)
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const calm = !shown.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches
      shown.current = true
      reveal(calm ? "instant" : "smooth")
    })
    return () => cancelAnimationFrame(frame)
  }, [value, reveal])

  // Both layers move only their clip, on the same spring.
  const move = "transition-[clip-path] duration-(--duration-spring) ease-(--ease-spring) motion-reduce:transition-none"

  return (
    <TabsPrimitive.Root data-slot="pill-tabs" className={cn("min-w-0", className)} {...props}>
      <div
        ref={scroller}
        data-fade-start={edges.start || undefined}
        data-fade-end={edges.end || undefined}
        className={cn(
          "w-max max-w-full overflow-x-auto overscroll-x-contain rounded-full bg-muted",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // Scroll edge effect instead of a hard cut: a 28px fade at an end
          // only while tabs are hidden past it.
          "[--fade-l:0px] [--fade-r:0px] data-fade-start:[--fade-l:28px] data-fade-end:[--fade-r:28px]",
          "[mask-image:linear-gradient(to_right,transparent,#000_var(--fade-l),#000_calc(100%-var(--fade-r)),transparent)]",
          listClassName
        )}
      >
        <TabsPrimitive.List aria-label={label} className="relative flex w-max gap-1 p-1">
          <TabsPrimitive.Indicator
            renderBeforeHydration
            aria-hidden="true"
            className={cn(
              // The ring: the whole list cut to the active tab. Its 1px of
              // --input shows round the face below (3:1 edge, WCAG 1.4.11);
              // a box-shadow would be cut away by the clip.
              "pointer-events-none absolute inset-0 bg-(--input)",
              "[clip-path:inset(var(--active-tab-top)_var(--active-tab-right)_var(--active-tab-bottom)_var(--active-tab-left)_round_999px)]",
              move
            )}
          >
            <span
              className={cn(
                "absolute inset-0 bg-background dark:bg-secondary",
                "[clip-path:inset(calc(var(--active-tab-top)+1px)_calc(var(--active-tab-right)+1px)_calc(var(--active-tab-bottom)+1px)_calc(var(--active-tab-left)+1px)_round_999px)]",
                move
              )}
            />
          </TabsPrimitive.Indicator>
          {children}
        </TabsPrimitive.List>
      </div>
      {panels}
    </TabsPrimitive.Root>
  )
}

function PillTab({
  className,
  icon,
  children,
  ...props
}: TabsPrimitive.Tab.Props & {
  /** Iconsax icon, decorative (the label names the tab). */
  icon?: React.ReactNode
}) {
  return (
    <TabsPrimitive.Tab
      data-slot="pill-tab"
      className={cn(
        "relative z-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 whitespace-nowrap select-none",
        // 44px to tap on phones, inside the list's 4px padding (A36).
        "hit-44",
        "text-(length:--text-body) leading-none font-medium text-muted-foreground",
        // The label answers the press at once (apple-design: response on
        // pointer-down); the pill follows on its spring.
        "transition-[color,scale] duration-(--duration-fast) ease-(--ease-out)",
        "pointer-fine:not-data-active:hover:text-foreground active:scale-[0.96]",
        "data-active:text-foreground",
        "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ring)",
        "data-disabled:cursor-not-allowed data-disabled:opacity-40",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {icon && <span aria-hidden="true" className="inline-grid">{icon}</span>}
      {children}
    </TabsPrimitive.Tab>
  )
}

function PillTabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel data-slot="pill-tabs-panel" className={cn("outline-none", className)} {...props} />
}

export { PillTabs, PillTab, PillTabsPanel }
