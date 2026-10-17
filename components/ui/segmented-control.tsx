"use client"

import * as React from "react"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { cn } from "cn"

// Width the row needs on one line, and the width its parent offers.
function useFitsOnOneLine<T extends HTMLElement>(auto: boolean) {
  const ref = React.useRef<T>(null)
  const [vertical, setVertical] = React.useState(false)
  React.useLayoutEffect(() => {
    const track = ref.current
    const parent = track?.parentElement
    if (!auto || !track || !parent) return
    // Equal columns need n × the widest item (its full label, nowrap, plus its
    // padding) plus the gaps and track padding. The label is measured as a
    // range, so the sum is the same in either orientation and tells a vertical
    // track when it may go back to one row.
    const range = document.createRange()
    const natural = (el: HTMLElement) => {
      range.selectNodeContents(el)
      const s = getComputedStyle(el)
      return range.getBoundingClientRect().width + parseFloat(s.paddingLeft) + parseFloat(s.paddingRight)
    }
    const check = () => {
      const items = [...track.children].filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el.dataset.slot === "segmented-item"
      )
      if (!items.length) return
      const style = getComputedStyle(track)
      const widest = Math.max(...items.map(natural))
      const needed =
        widest * items.length +
        parseFloat(style.columnGap || "0") * (items.length - 1) +
        parseFloat(style.paddingLeft) +
        parseFloat(style.paddingRight)
      const box = getComputedStyle(parent)
      const room = parent.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight)
      setVertical(needed > room + 0.5)
    }
    // Measuring with the fallback face first could pick "vertical" and then flip
    // back when the web font lands, moving everything below (#346). Until the
    // fonts are ready the row stays as the server drew it (horizontal).
    let live = true
    let ready = document.fonts.status === "loaded"
    const guarded = () => {
      if (live && ready) check()
    }
    if (ready) check()
    else
      document.fonts.ready.then(() => {
        ready = true
        guarded()
      })
    const observer = new ResizeObserver(guarded)
    observer.observe(parent)
    // Label widths change when a later web font arrives.
    document.fonts.addEventListener("loadingdone", guarded)
    return () => {
      live = false
      observer.disconnect()
      document.fonts.removeEventListener("loadingdone", guarded)
    }
  }, [auto])
  return [ref, vertical] as const
}

// One-of-few choice shown as a pill row (price basis, period, sort). Base UI
// RadioGroup gives role="radiogroup", arrow-key movement and a single tab
// stop; name the group with aria-label or aria-labelledby.
//
// Never wraps: items share one width (Apple segmented control). `fill`
// stretches the row to its parent. When the parent cannot hold the row on one
// line, the items stack as a vertical list instead of breaking mid-row.
function SegmentedControl({
  className,
  fill = false,
  orientation = "auto",
  ...props
}: RadioGroup.Props & {
  fill?: boolean
  /** "auto" measures after the web font is ready. A screen that knows the slot
   * is narrow can fix "vertical" so the server HTML is already stacked (no shift). */
  orientation?: "auto" | "horizontal" | "vertical"
}) {
  const [ref, measuredVertical] = useFitsOnOneLine<HTMLDivElement>(orientation === "auto")
  const vertical = orientation === "auto" ? measuredVertical : orientation === "vertical"
  return (
    <RadioGroup
      ref={ref}
      data-slot="segmented-control"
      data-orientation={vertical ? "vertical" : "horizontal"}
      className={cn(
        "grid max-w-full gap-1 bg-muted p-1",
        // Equal columns on one row; a full pill on a 40px row.
        "data-[orientation=horizontal]:auto-cols-fr data-[orientation=horizontal]:grid-flow-col data-[orientation=horizontal]:rounded-full",
        // Stacked: full-width rows in a rounded box.
        "data-[orientation=vertical]:w-full data-[orientation=vertical]:grid-flow-row data-[orientation=vertical]:rounded-[20px]",
        // Phones: stacked rows 44px apart so each 44px tap area (hit-44) is its own (A36).
        "max-[699px]:data-[orientation=vertical]:gap-3 pointer-coarse:data-[orientation=vertical]:gap-3",
        fill ? "w-full" : "w-max",
        // Keep the track at its own height inside grid/flex columns (a stretched
        // track left the pills hugging its top edge).
        "items-center self-start justify-self-start",
        className
      )}
      {...props}
    />
  )
}

function SegmentedItem({ className, ...props }: Radio.Root.Props) {
  return (
    <Radio.Root
      data-slot="segmented-item"
      className={cn(
        "inline-flex h-8 min-w-0 items-center justify-center rounded-full px-4 whitespace-nowrap select-none",
        // 44px to tap on phones; the 32px face stays (A36).
        "hit-44",
        "text-(length:--text-body) leading-none text-foreground",
        "transition-[background-color,box-shadow,color,scale] duration-(--duration-fast) ease-(--ease-out)",
        // Answers the press at once (apple-design: feedback on pointer-down);
        // the face settles when the choice lands.
        "not-data-disabled:active:scale-(--press-scale)",
        "pointer-fine:not-data-checked:not-data-disabled:hover:bg-secondary",
        // Selected: a raised face outlined in --input (3:1 against the track, WCAG
        // 1.4.11); no weight change, so the row does not reflow.
        "data-checked:bg-background data-checked:shadow-[0_0_0_1px_var(--input)]",
        // In dark the face must sit lighter than the track.
        "dark:data-checked:bg-secondary",
        "data-disabled:cursor-not-allowed data-disabled:text-faint",
        className
      )}
      {...props}
    />
  )
}

export { SegmentedControl, SegmentedItem }
