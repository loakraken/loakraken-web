"use client"

import * as React from "react"

// Key number that counts up when it appears (combat power, total gold), then
// simply shows new values on refresh. It counts the last stretch only (from
// 90% of the value) inside a box sized by the final text, so nothing beside it
// moves (#315). Screen readers get the final value from the start; the
// counting digits are hidden from them. Reduced motion shows the final value
// immediately. Keep it to one headline number of a screen (motion guide 7.1),
// never numbers inside tables.
type CountUpProps = Omit<React.ComponentProps<"span">, "children"> & {
  value: number
  /** Formats every frame and the final value (e.g. v => v.toLocaleString("ko-KR", { maximumFractionDigits: 2 })). */
  format?: (value: number) => string
  /** Where counting starts, as a share of the value (default 0.9). */
  from?: number
}

const DURATION_FALLBACK = 400
// --ease-out cubic-bezier(0.23, 1, 0.32, 1), approximated for rAF frames.
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4)
const defaultFormat = (v: number) => v.toLocaleString("ko-KR")

function readDuration(element: HTMLElement) {
  const raw = getComputedStyle(element).getPropertyValue("--duration-count").trim()
  const ms = raw.endsWith("ms") ? parseFloat(raw) : raw.endsWith("s") ? parseFloat(raw) * 1000 : NaN
  return Number.isFinite(ms) ? ms : DURATION_FALLBACK
}

function CountUp({ value, format = defaultFormat, from = 0.9, className, ...props }: CountUpProps) {
  const digits = React.useRef<HTMLSpanElement>(null)
  const latest = React.useRef({ value, format, from })

  React.useEffect(() => {
    latest.current = { value, format, from }
  }, [value, format, from])

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
    const first = latest.current
    node.nodeValue = first.format(first.value * first.from)
    const tick = (now: number) => {
      // A frame's timestamp can be earlier than `start` (it marks the frame's
      // beginning), so clamp to 0 or the first frame shows a value below the start.
      const t = Math.max(0, Math.min(1, (now - start) / duration))
      const { value: target, format: fmt, from: share } = latest.current
      node.nodeValue = fmt(t < 1 ? target * (share + (1 - share) * easeOut(t)) : target)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      node.nodeValue = latest.current.format(latest.current.value)
    }
  }, [])

  const finalText = format(value)
  // The invisible final text holds the width; the counting digits sit on it
  // in the same grid cell, end-aligned like an odometer.
  return (
    <span data-slot="count-up" className={className} {...props}>
      <span aria-hidden className="inline-grid tabular-nums">
        <span className="invisible [grid-area:1/1]">{finalText}</span>
        <span ref={digits} className="justify-self-end [grid-area:1/1]">
          {finalText}
        </span>
      </span>
      <span className="sr-only">{finalText}</span>
    </span>
  )
}

export { CountUp }
export type { CountUpProps }
