"use client"

import * as React from "react"
import { cn } from "cn"

const LOOP_MS = 1500
// Motion that starts on its own stops within 5 s (the site rule since v0.2.0,
// and pause-stop-hide): three passes, then the label stands still.
const LOOPS = 3

// One beat for the page: a label drawn while a beat runs joins it (same phase,
// stops together); one drawn after it ended starts the next.
let beat: number | null = null

/**
 * "집계 중…" for a value that is still being gathered (user 10-16): a band of
 * light across the letters, the shared `shimmer` utility at 1.5 s, three
 * passes. Only the paint moves — the text and its box stay as they are (A7),
 * and the "…" is there from the start so stopping changes nothing. With
 * reduced motion it stands still from the start.
 * No role of its own: the region around it says it is busy, once.
 */
function PendingText({ className }: { className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  React.useEffect(() => {
    const animations = ref.current?.getAnimations() ?? []
    if (!animations.length) return
    const now = Number(document.timeline.currentTime ?? 0)
    if (beat === null || now >= beat + LOOP_MS * LOOPS) beat = now
    for (const animation of animations) animation.startTime = beat
  }, [])
  return (
    <span
      ref={ref}
      data-slot="pending-text"
      className={cn(
        // The "…" is for the eye only (an empty alternative text); in forced
        // colours the band (a background) would go and leave clear text, so
        // there the label is plain text.
        "shimmer [--shimmer-duration:1.5s] after:[content:'…'_/_'']",
        "forced-colors:animate-none forced-colors:bg-none forced-colors:[-webkit-text-fill-color:currentColor]",
        className
      )}
      style={{ animationIterationCount: LOOPS }}
    >
      집계 중
    </span>
  )
}

export { PendingText }
