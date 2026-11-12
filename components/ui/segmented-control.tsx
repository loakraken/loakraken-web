"use client"

import * as React from "react"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { cn } from "cn"
import { SEGMENTED_ITEM_PAD_PX, segmentedRowWidth } from "@/lib/ui/segmented-width"

// The labels of the items, when each is plain text (or a number); null when one
// is not (an icon, nested spans): such a row passes `labels`, or never stacks.
function itemLabels(children: React.ReactNode): { labels: string[]; pad: number } | null {
  const labels: string[] = []
  let pad = SEGMENTED_ITEM_PAD_PX
  for (const child of React.Children.toArray(children)) {
    if (!React.isValidElement<{ children?: React.ReactNode; className?: string }>(child)) return null
    const parts = React.Children.toArray(child.props.children)
    if (!parts.length || !parts.every((part) => typeof part === "string" || typeof part === "number")) return null
    labels.push(parts.join(""))
    // An item with narrower sides (px-3: 12px), unprefixed so it holds at every width.
    const side = /(?:^|\s)px-(\d+(?:\.\d+)?)(?=\s|$)/.exec(child.props.className ?? "")
    if (side) pad = Math.min(pad, Number(side[1]) * 4)
  }
  return labels.length ? { labels, pad } : null
}

// One-of-few choice shown as a pill row (price basis, period, sort). Base UI
// RadioGroup gives role="radiogroup", arrow-key movement and a single tab
// stop; name the group with aria-label or aria-labelledby.
//
// Never wraps: items share one width (Apple segmented control). `fill`
// stretches the row to its parent. When the parent cannot hold the row on one
// line, the items stack as a vertical list instead of breaking mid-row.
//
// "auto" decides that in CSS, before the first paint: the row's width comes
// from its labels (lib/ui/segmented-width.ts, the widest face the font stack can
// draw them in) and a container query on a full-width frame stacks the items
// when the parent offers less. Nothing is measured after the fonts load, so
// nothing below moves (#346, #1145, /market/quote 360·375 CLS 0.15 at 1.6 Mbps).
function SegmentedControl({
  className,
  fill = false,
  orientation = "auto",
  labels,
  children,
  ...props
}: RadioGroup.Props & {
  fill?: boolean
  /** "auto" stacks the row in CSS when its parent is narrower than the labels
   * need. "horizontal"/"vertical" fix it. */
  orientation?: "auto" | "horizontal" | "vertical"
  /** The text the width is decided from when an item is not plain text (nested
   * spans, an icon); without it such a row is never stacked. */
  labels?: string[]
}) {
  const found =
    orientation !== "auto" ? null : labels?.length ? { labels, pad: SEGMENTED_ITEM_PAD_PX } : itemLabels(children)
  const stackBelow = found ? segmentedRowWidth(found.labels, found.pad) : null
  const vertical = orientation === "vertical"
  const track = (
    <RadioGroup
      data-slot="segmented-control"
      data-orientation={stackBelow != null ? "auto" : vertical ? "vertical" : "horizontal"}
      className={cn(
        "grid max-w-full gap-1 bg-muted p-1",
        // Equal columns on one row; a full pill on a 40px row. ("auto" starts
        // here and the frame's container query stacks it, see below.)
        "data-[orientation=horizontal]:auto-cols-fr data-[orientation=horizontal]:grid-flow-col data-[orientation=horizontal]:rounded-full",
        "data-[orientation=auto]:auto-cols-fr data-[orientation=auto]:grid-flow-col data-[orientation=auto]:rounded-full",
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
    >
      {children}
    </RadioGroup>
  )
  if (stackBelow == null) return track
  // The frame takes the width the parent offers (the old measurement's "room")
  // and is the container the query reads. The stacked look is the vertical
  // state above, written out; one attribute more specific than the row classes.
  const at = `[data-stack-below="${stackBelow}"] [data-slot="segmented-control"][data-orientation="auto"]`
  return (
    <div
      data-slot="segmented-frame"
      data-stack-below={stackBelow}
      className="w-full min-w-0 self-start [container-type:inline-size]"
    >
      <style
        // Plain CSS text (no markup); the selector names this row's width only.
        dangerouslySetInnerHTML={{
          __html:
            `@container (width < ${stackBelow}px){${at}{width:100%;grid-auto-flow:row;grid-auto-columns:auto;border-radius:20px}` +
            `@media (max-width:699px),(pointer:coarse){${at}{row-gap:12px}}}`,
        }}
      />
      {track}
    </div>
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
