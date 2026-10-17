import { cn } from "cn"
import { curve } from "@/components/ui/bencho/balance-curve"

// A small trend line for a row (a price over 7 or 14 days in the market list),
// drawn as one SVG path with the monotone curve the market chart already uses
// (balance-curve.ts), so between two readings it never invents a value.
// PM 총괄 02:24 ⑥: written here rather than taken from Appica UI's Sparkline
// (MIT, 490 lines): that one is an interactive chart with a pointer tooltip
// that moves by left/top; a row needs a still picture and one sentence.
//
// No motion, no interaction. Colour says up or down only together with the
// sentence a screen reader hears ("7일 동안 12% 올랐어요"), and the end dot.
// A server component: no client JS.

type SparklineProps = Omit<React.ComponentProps<"svg">, "children" | "values"> & {
  /** Oldest first. Fewer than two readings draws nothing. */
  values: readonly number[]
  /** Read out instead of the picture, e.g. "최근 7일 평균 거래가 추이, 12% 상승". */
  label: string
  /** "up" / "down" colours (market tokens); "auto" picks from first vs last. */
  tone?: "auto" | "up" | "down" | "neutral"
  width?: number
  height?: number
  /** Fill the area under the line faintly. */
  area?: boolean
}

function Sparkline({
  values,
  label,
  tone = "auto",
  width = 72,
  height = 24,
  area = false,
  className,
  ...props
}: SparklineProps) {
  const finite = values.filter((v) => Number.isFinite(v))
  if (finite.length < 2) return null
  const resolved =
    tone !== "auto" ? tone : finite[finite.length - 1] > finite[0] ? "up" : finite[finite.length - 1] < finite[0] ? "down" : "neutral"
  const color =
    resolved === "up" ? "var(--market-up)" : resolved === "down" ? "var(--market-down)" : "var(--muted-foreground)"
  // 3px inside the box so the 1.5px stroke and the end dot are not clipped
  const pad = 3
  const w = width - pad * 2
  const flat = Math.min(...finite) === Math.max(...finite)
  // A flat run sits in the middle, not on the floor (the curve maps an empty
  // range to its bottom edge).
  const line = flat
    ? { d: `M0 ${height / 2} L${w} ${height / 2}`, area: `M0 ${height / 2} L${w} ${height / 2} L${w} ${height} L0 ${height} Z`, pt: [{ x: w, y: height / 2 }] }
    : curve(finite, w, height, pad)
  const end = line.pt[line.pt.length - 1]
  return (
    <svg
      data-slot="sparkline"
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`${-pad} 0 ${width} ${height}`}
      className={cn("inline-block shrink-0 overflow-visible align-middle", className)}
      {...props}
    >
      {area && <path d={line.area} fill={color} opacity={0.12} />}
      <path d={line.d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={end.x} cy={end.y} r={2} fill={color} />
    </svg>
  )
}

export { Sparkline }
export type { SparklineProps }
