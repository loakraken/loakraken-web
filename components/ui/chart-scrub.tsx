"use client"

import * as React from "react"
import { cn } from "cn"

// Pointer, touch and keyboard scrubbing for our SVG charts (PM 총괄 10-12 04:58
// ③ — the market's daily chart now, minute charts K35·K36 next). One hook gives
// the active reading; the crosshair and the tooltip are drawn by the chart.
//
// - nearest reading by binary search over the x positions (a minute chart has
//   hundreds of points; scanning all of them on every pointermove is waste);
// - touch: a press shows the reading, a sideways drag follows it, an upward or
//   downward swipe still scrolls the page (touch-action: pan-y) and clears it;
// - keyboard: ← → move one reading (no other keys: checklist A20);
// - the tooltip moves by transform only (no left/top), so scrubbing never
//   lays the page out again.

type ScrubOptions = {
  /** Number of readings. */
  count: number
  /** The x of reading i in the SVG's own units (viewBox). */
  xOf: (i: number) => number
  /** The SVG's viewBox width, to turn a pointer position into SVG units. */
  viewWidth: number
}

function nearest(count: number, xOf: (i: number) => number, x: number) {
  let lo = 0
  let hi = count - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xOf(mid) < x) lo = mid
    else hi = mid
  }
  return Math.abs(xOf(lo) - x) <= Math.abs(xOf(hi) - x) ? lo : hi
}

function useChartScrub({ count, xOf, viewWidth }: ScrubOptions) {
  const [active, setActive] = React.useState<number | null>(null)
  const last = count - 1

  const pick = (event: React.PointerEvent<SVGSVGElement>) => {
    if (count < 1) return
    const box = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * viewWidth
    setActive(nearest(count, xOf, x))
  }

  const svgProps = {
    tabIndex: 0,
    // no grey tap flash on a press (the crosshair answers the touch)
    style: { touchAction: "pan-y", WebkitTapHighlightColor: "transparent" } as React.CSSProperties,
    onPointerDown: pick,
    onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => {
      // a mouse follows on hover; a finger only while it is down on the chart
      if (event.pointerType !== "mouse" && event.buttons === 0) return
      pick(event)
    },
    onPointerLeave: (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.pointerType === "mouse") setActive(null)
    },
    // the page took the gesture (a vertical scroll): let the reading go
    onPointerCancel: () => setActive(null),
    onBlur: () => setActive(null),
    onKeyDown: (event: React.KeyboardEvent<SVGSVGElement>) => {
      const at = active ?? last
      const next =
        event.key === "ArrowRight" ? at + 1 : event.key === "ArrowLeft" ? at - 1 : null
      if (next === null) return
      event.preventDefault()
      setActive(Math.min(last, Math.max(0, next)))
    },
  }
  return { active, setActive, svgProps }
}

/** A vertical line at x from y0 to y1 (SVG units), decorative. */
function ChartCrosshair({ x, y0, y1, className }: { x: number; y0: number; y1: number; className?: string }) {
  return (
    <line
      data-slot="chart-crosshair"
      x1={x}
      x2={x}
      y1={y0}
      y2={y1}
      aria-hidden="true"
      className={cn("stroke-(--faint) [stroke-dasharray:3_3]", className)}
      vectorEffect="non-scaling-stroke"
    />
  )
}

/**
 * A small card that follows the reading. Place it in a position:relative box
 * the same size as the SVG; x and y are SVG units, scale = rendered px per
 * unit (box width / viewBox width). It sits above the point and slides along
 * it by the point's share of the box: at the left edge the card starts at the
 * point, at the right edge it ends there, in between it keeps the same share on
 * each side. So it never leaves the box while it is narrower than the box, with
 * no measuring (one transform, no re-render): a flip at 62% let a wide card
 * ('이날은 기록이 없어요') run off a 320 screen near either end (codex #1788 P3).
 * aria-hidden: the chart's readout (a polite live line) is what a screen reader hears.
 */
function ChartTooltip({
  x,
  y,
  scale = 1,
  boxWidth,
  children,
  className,
}: {
  x: number
  y: number
  scale?: number
  /** Rendered width of the box, to keep the card inside it. */
  boxWidth: number
  children: React.ReactNode
  className?: string
}) {
  const px = x * scale
  // The point's share of the box, 0 at the left edge to 1 at the right.
  const share = boxWidth > 0 ? Math.min(1, Math.max(0, px / boxWidth)) : 0
  return (
    <div
      data-slot="chart-tooltip"
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-0 left-0 z-10 w-max rounded-(--radius-sm) bg-(--popover) px-2.5 py-1.5",
        "text-(length:--text-caption) text-(--popover-foreground) tabular-nums shadow-(--shadow-pop)",
        className
      )}
      style={{
        transform: `translate(${px}px, ${y * scale}px) translate(${(-share * 100).toFixed(2)}%, -100%)`,
      }}
    >
      {children}
    </div>
  )
}

export { useChartScrub, ChartCrosshair, ChartTooltip }
export type { ScrubOptions }
