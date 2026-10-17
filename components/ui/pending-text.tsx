"use client"

import * as React from "react"
import { cn } from "cn"

/**
 * "집계 중" for a value that is still being gathered (user 10-16): a band of
 * light across the letters every 1.5s, the shared `shimmer` utility. Only the
 * paint moves — the text and its box stay as they are (A7). Every label on the
 * page runs on the same beat, however late it was drawn: its loop starts at the
 * document's time origin. With reduced motion it stands still as "집계 중…".
 * No role of its own: the region around it says it is busy, once.
 */
function PendingText({ className }: { className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  React.useEffect(() => {
    for (const animation of ref.current?.getAnimations() ?? []) animation.startTime = 0
  }, [])
  return (
    <span
      ref={ref}
      data-slot="pending-text"
      className={cn("shimmer [--shimmer-duration:1.5s] motion-reduce:after:content-['…']", className)}
    >
      집계 중
    </span>
  )
}

export { PendingText }
