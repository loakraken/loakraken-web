"use client"

import * as React from "react"
import { cn } from "cn"

// A horizontal progress bar that grows once, the first time it is seen
// (user proposal 10-11 21:09, PM 총괄): 0 → value by scaleX from the left
// edge, so nothing around it moves (CLS 0); rows step 35ms apart and the
// whole set finishes inside 0.6s; the number beside it is final from the
// start (no count-up). It does not grow again when scrolled back to —
// charts redrawing on every return was a user complaint (10-10).
//
// How: CSS draws the final bar. A bar inserted on screen grows from 0 by
// @starting-style. A bar that is off screen when it mounts is held at 0
// (data-pending, no transition) until it enters the view, then grows —
// so it is never seen jumping. Reduced motion: the final bar, no motion.

const subscribeReduce = (onChange: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)")
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

type ProgressBarProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** 0 to 1 (clamped). */
  value: number
  /** The bar's name for a screen reader, e.g. "모코코 씨앗 진행률". */
  label: string
  /** Row index in a list, for the 35ms step (capped so a set ends inside 0.6s). */
  index?: number
  /** The fill's colour etc. (default --primary, as the tabs used). */
  fillClassName?: string
}

function ProgressBar({ value, label, index = 0, className, fillClassName, ...props }: ProgressBarProps) {
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
  const ref = React.useRef<HTMLSpanElement>(null)
  const [pending, setPending] = React.useState(false)
  const reduce = React.useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true
  )

  // Off screen at mount: hold at 0 until first seen, then let it grow.
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el || reduce) return
    const box = el.getBoundingClientRect()
    const onScreen = box.bottom > 0 && box.top < window.innerHeight
    if (onScreen) return
    setPending(true)
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      // two frames: the held 0 must be painted before the transition starts
      requestAnimationFrame(() => requestAnimationFrame(() => setPending(false)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [reduce])

  return (
    <span
      ref={ref}
      data-slot="progress-bar"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={cn("block h-1.5 overflow-hidden rounded-full bg-secondary", className)}
      {...props}
    >
      <i
        data-pending={pending || undefined}
        style={
          {
            "--progress": v,
            transitionDelay: `${Math.min(index, 5) * 35}ms`,
          } as React.CSSProperties
        }
        className={cn(
          "block h-full origin-left rounded-full bg-primary [transform:scaleX(var(--progress))]",
          "transition-transform duration-[420ms] ease-(--ease-out) starting:[transform:scaleX(0)]",
          "data-pending:[transform:scaleX(0)] data-pending:transition-none",
          "motion-reduce:transition-none",
          fillClassName
        )}
      />
    </span>
  )
}

export { ProgressBar }
export type { ProgressBarProps }
