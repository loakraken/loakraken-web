"use client"

import * as React from "react"

// Key number that counts up the first time it appears (combat power, total
// gold, top %), then simply shows new values on refresh. Screen readers get
// the final value from the start; the counting digits are hidden from them.
// Reduced motion shows the final value immediately. Keep it to the one to
// three headline numbers of a screen, never numbers inside tables.
type CountUpProps = Omit<React.ComponentProps<"span">, "children"> & {
  value: number
  /** Formats every frame and the final value (e.g. v => v.toLocaleString("ko-KR", { maximumFractionDigits: 2 })). */
  format?: (value: number) => string
}

const DURATION_FALLBACK = 500
// --ease-out cubic-bezier(0.23, 1, 0.32, 1), approximated for rAF frames.
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4)
const defaultFormat = (v: number) => v.toLocaleString("ko-KR")

function readDuration(element: HTMLElement) {
  const raw = getComputedStyle(element).getPropertyValue("--duration-count").trim()
  const ms = raw.endsWith("ms") ? parseFloat(raw) : raw.endsWith("s") ? parseFloat(raw) * 1000 : NaN
  return Number.isFinite(ms) ? ms : DURATION_FALLBACK
}

function CountUp({ value, format = defaultFormat, className, ...props }: CountUpProps) {
  const digits = React.useRef<HTMLSpanElement>(null)
  const latest = React.useRef({ value, format })

  React.useEffect(() => {
    latest.current = { value, format }
  }, [value, format])

  // Runs once. The frames write the text node React rendered, so there is no
  // re-render per frame; it starts before paint, so a number that mounts with
  // its data never flashes its final value first. Later values (refresh) are
  // rendered by React directly, with no animation.
  React.useLayoutEffect(() => {
    const element = digits.current
    const node = element?.firstChild
    if (!element || !(node instanceof Text)) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const duration = readDuration(element)
    const start = performance.now()
    let frame = 0
    node.nodeValue = latest.current.format(0)
    const tick = (now: number) => {
      // A frame's timestamp can be earlier than `start` (it marks the frame's
      // beginning), so clamp to 0 or the first frame shows a negative value.
      const t = Math.max(0, Math.min(1, (now - start) / duration))
      const { value: target, format: fmt } = latest.current
      node.nodeValue = fmt(t < 1 ? target * easeOut(t) : target)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      node.nodeValue = latest.current.format(latest.current.value)
    }
  }, [])

  const finalText = format(value)
  return (
    <span data-slot="count-up" className={className} {...props}>
      <span ref={digits} aria-hidden className="tabular-nums">
        {finalText}
      </span>
      <span className="sr-only">{finalText}</span>
    </span>
  )
}

export { CountUp }
export type { CountUpProps }
