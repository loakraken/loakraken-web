import * as React from "react"
import { cn } from "cn"

// Equipment quality as the target sites show it: a small coloured badge with
// a bold white number (iloa: 11/600, 17px tall, 4px radius, 2px 6px padding).
// Colours are the --quality-* tokens (PM decision D1, all past 4.5:1).
type QualityTier = "max" | "high" | "good" | "normal" | "low" | "poor"

/** In-game quality bands: 100 / 90~99 / 70~89 / 30~69 / 10~29 / 0~9. */
function qualityTier(value: number | null | undefined): QualityTier | "none" {
  if (value == null || value < 0) return "none"
  if (value >= 100) return "max"
  if (value >= 90) return "high"
  if (value >= 70) return "good"
  if (value >= 30) return "normal"
  if (value >= 10) return "low"
  return "poor"
}

const badgeBase =
  "inline-flex h-[17px] min-w-[27px] shrink-0 items-center justify-center rounded-[4px] px-1.5 text-(length:--text-badge) leading-none font-semibold tabular-nums whitespace-nowrap"

type QualityBadgeProps = Omit<React.ComponentProps<"span">, "children"> & {
  value: number | null | undefined
}

function QualityBadge({ value, className, ...props }: QualityBadgeProps) {
  const tier = qualityTier(value)
  return (
    <span
      data-slot="quality-badge"
      data-tier={tier}
      className={cn(
        badgeBase,
        "data-[tier=max]:bg-(--quality-max) data-[tier=max]:text-(--quality-max-foreground)",
        "data-[tier=high]:bg-(--quality-high) data-[tier=high]:text-(--quality-high-foreground)",
        "data-[tier=good]:bg-(--quality-good) data-[tier=good]:text-(--quality-good-foreground)",
        "data-[tier=normal]:bg-(--quality-normal) data-[tier=normal]:text-(--quality-normal-foreground)",
        "data-[tier=low]:bg-(--quality-low) data-[tier=low]:text-(--quality-low-foreground)",
        "data-[tier=poor]:bg-(--quality-poor) data-[tier=poor]:text-(--quality-poor-foreground)",
        // Unmeasured quality: no fill, as on iloa.
        "data-[tier=none]:text-muted-foreground data-[tier=none]:shadow-[inset_0_0_0_1px_var(--border)]",
        className
      )}
      {...props}
    >
      <span className="sr-only">품질 </span>
      {tier === "none" ? (
        <>
          <span aria-hidden>—</span>
          <span className="sr-only">미측정</span>
        </>
      ) : (
        value
      )}
    </span>
  )
}

// Neutral chip beside the quality badge (item level, ark passive points).
function LevelBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="level-badge"
      className={cn(badgeBase, "bg-secondary font-medium text-foreground", className)}
      {...props}
    />
  )
}

export { LevelBadge, QualityBadge, qualityTier }
export type { QualityBadgeProps, QualityTier }
