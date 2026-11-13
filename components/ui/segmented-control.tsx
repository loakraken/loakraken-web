"use client"

import * as React from "react"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { cn } from "cn"
import { SEGMENTED_ITEM_PAD_PX, type SegmentedLabel, segmentedRowWidth } from "@/lib/ui/segmented-width"

// The items' labels and sides, when each label is plain text (or a number); null
// when one is not (an icon, nested spans): such a row passes `labels`, or never stacks.
function itemLabels(children: React.ReactNode): SegmentedLabel[] | null {
  const items: SegmentedLabel[] = []
  for (const child of React.Children.toArray(children)) {
    if (!React.isValidElement<{ children?: React.ReactNode; className?: string }>(child)) return null
    const parts = React.Children.toArray(child.props.children)
    if (!parts.length || !parts.every((part) => typeof part === "string" || typeof part === "number")) return null
    // An item with its own sides (px-3: 12px), unprefixed so it holds at every width.
    const side = /(?:^|\s)px-(\d+(?:\.\d+)?)(?=\s|$)/.exec(child.props.className ?? "")
    items.push({ text: parts.join(""), pad: side ? Number(side[1]) * 4 : SEGMENTED_ITEM_PAD_PX })
  }
  return items.length ? items : null
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
// draw them in) and a container query stacks the items when the container is
// narrower. Nothing is measured after the fonts load, so nothing below moves
// (#346, #1145, /market/quote 360·375 CLS 0.15 at 1.6 Mbps).
//
// The container is a full-width frame around the row by default. A container
// has no width of its own content (inline-size containment), so a row whose
// parent sizes to its content (an auto grid column, a flex row next to other
// controls) either fixes its orientation or passes frame={false} and makes a
// full-width ancestor the container (container-type: inline-size).
function SegmentedControl({
  className,
  fill = false,
  orientation = "auto",
  labels,
  frame = true,
  children,
  ...props
}: RadioGroup.Props & {
  fill?: boolean
  /** "auto" stacks the row in CSS when its container is narrower than the
   * labels need. "horizontal"/"vertical" fix it. */
  orientation?: "auto" | "horizontal" | "vertical"
  /** The text the width is decided from when an item is not plain text (nested
   * spans, an icon); without it such a row is never stacked. */
  labels?: string[]
  /** false: no frame; the nearest ancestor with container-type: inline-size is
   * the container (for rows inside content-sized parents). */
  frame?: boolean
}) {
  const found =
    orientation !== "auto"
      ? null
      : labels?.length
        ? labels.map((text) => ({ text, pad: SEGMENTED_ITEM_PAD_PX }))
        : itemLabels(children)
  const stackBelow = found ? segmentedRowWidth(found) : null
  const vertical = orientation === "vertical"
  const track = (
    <RadioGroup
      data-slot="segmented-control"
      data-orientation={stackBelow != null ? "auto" : vertical ? "vertical" : "horizontal"}
      data-stack-below={stackBelow ?? undefined}
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
  // The stacked look is the vertical state above, written out; one attribute
  // more specific than the row classes. Without container queries the row is
  // always stacked (never cut).
  const at = `[data-slot="segmented-control"][data-orientation="auto"][data-stack-below="${stackBelow}"]`
  const stacked = `${at}{width:100%;grid-auto-flow:row;grid-auto-columns:auto;border-radius:20px}`
  const gap = `@media (max-width:699px),(pointer:coarse){${at}{row-gap:12px}}`
  const style = (
    <style
      // Plain CSS text (no markup); the selector names this row's width only.
      dangerouslySetInnerHTML={{
        __html:
          `@container (width < ${stackBelow}px){${stacked}${gap}}` +
          `@supports not (container-type:inline-size){${stacked}${gap}}`,
      }}
    />
  )
  if (!frame)
    return (
      <>
        {style}
        {track}
      </>
    )
  // The frame takes the width the parent offers (the old measurement's "room").
  return (
    <div data-slot="segmented-frame" className="w-full min-w-0 self-start [container-type:inline-size]">
      {style}
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
