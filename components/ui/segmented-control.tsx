"use client"

import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { cn } from "cn"

// One-of-few choice shown as a pill row (price basis, period, sort). Base UI
// RadioGroup gives role="radiogroup", arrow-key movement and a single tab
// stop; name the group with aria-label or aria-labelledby.
function SegmentedControl({ className, ...props }: RadioGroup.Props) {
  return (
    <RadioGroup
      data-slot="segmented-control"
      className={cn(
        // 20px = a full pill on one 40px row, a rounded box when it wraps.
        "inline-flex max-w-full flex-wrap gap-1 rounded-[20px] bg-muted p-1",
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
        "inline-flex h-8 items-center justify-center rounded-full px-4 whitespace-nowrap select-none",
        "text-(length:--text-body) text-foreground",
        "transition-[background-color,box-shadow,color] duration-(--duration-fast) ease-(--ease-out)",
        "pointer-fine:not-data-checked:not-data-disabled:hover:bg-secondary",
        // Selected: a raised face outlined in --input (3:1 against the track, WCAG
        // 1.4.11); no weight change, so the row does not reflow.
        "data-checked:bg-background data-checked:shadow-[0_0_0_1px_var(--input)]",
        // In dark the face must sit lighter than the track, as iloa's tabs do.
        "dark:data-checked:bg-secondary",
        "data-disabled:cursor-not-allowed data-disabled:text-faint",
        className
      )}
      {...props}
    />
  )
}

export { SegmentedControl, SegmentedItem }
