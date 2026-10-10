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
// The pill is one layer spanning the list, cut to the active tab with
// clip-path from Base UI's --active-tab-* variables: moving it repaints only
// that layer, with no layout and no width animation (performance rule).
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
  const list = React.useRef<HTMLDivElement>(null)
  const [edges, setEdges] = React.useState({ start: false, end: false })

  // Fades only where tabs are hidden: read after layout, on scroll and resize.
  React.useLayoutEffect(() => {
    const el = list.current
    if (!el) return
    const read = () => {
      const start = el.scrollLeft > 1
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      // Base UI's --active-tab-right is measured from the scrolled width, so
      // the pill layer must span all of it for the clip to land on the tab.
      el.style.setProperty("--pill-row-width", `${el.scrollWidth}px`)
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
    }
    read()
    const observer = new ResizeObserver(read)
    observer.observe(el)
    el.addEventListener("scroll", read, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener("scroll", read)
    }
  }, [])

  // Keep the chosen tab inside the row (scrolls the row only, never the page).
  const { value } = props
  React.useEffect(() => {
    const el = list.current
    const tab = el?.querySelector<HTMLElement>("[data-slot=pill-tab][data-active]")
    if (!el || !tab) return
    const pad = 24
    const left = tab.offsetLeft - pad
    const right = tab.offsetLeft + tab.offsetWidth + pad - el.clientWidth
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (left < el.scrollLeft) el.scrollTo({ left, behavior: reduce ? "instant" : "smooth" })
    else if (right > el.scrollLeft) el.scrollTo({ left: right, behavior: reduce ? "instant" : "smooth" })
  }, [value])

  return (
    <TabsPrimitive.Root data-slot="pill-tabs" className={cn("min-w-0", className)} {...props}>
      <TabsPrimitive.List
        ref={list}
        aria-label={label}
        data-fade-start={edges.start || undefined}
        data-fade-end={edges.end || undefined}
        className={cn(
          "relative flex max-w-full gap-1 overflow-x-auto overscroll-x-contain rounded-full bg-muted p-1",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // Scroll edge effect instead of a hard cut: a 28px fade at an end
          // only while tabs are hidden past it.
          "[--fade-l:0px] [--fade-r:0px] data-fade-start:[--fade-l:28px] data-fade-end:[--fade-r:28px]",
          "[mask-image:linear-gradient(to_right,transparent,#000_var(--fade-l),#000_calc(100%-var(--fade-r)),transparent)]",
          listClassName
        )}
      >
        <TabsPrimitive.Indicator
          renderBeforeHydration
          aria-hidden="true"
          className={cn(
            // Spans the whole scrolled row and is cut to the active tab, so it
            // scrolls with the tabs and only its clip moves.
            "pointer-events-none absolute top-0 left-0 h-full w-(--pill-row-width,100%) rounded-full",
            "bg-background shadow-[0_0_0_1px_var(--input),0_1px_2px_rgb(0_0_0/6%)] dark:bg-secondary",
            "[clip-path:inset(var(--active-tab-top)_var(--active-tab-right)_var(--active-tab-bottom)_var(--active-tab-left)_round_999px)]",
            "transition-[clip-path] duration-(--duration-spring) ease-(--ease-spring)",
            "motion-reduce:transition-none"
          )}
        />
        {children}
      </TabsPrimitive.List>
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
