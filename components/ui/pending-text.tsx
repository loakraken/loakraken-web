"use client"

import "./pending-text.css"
import * as React from "react"
import { cn } from "cn"

// One observer for every label: off screen means paused.
let seen: IntersectionObserver | null = null
const onScreen = new WeakMap<Element, (visible: boolean) => void>()
const observe = (el: Element, update: (visible: boolean) => void) => {
  seen ??= new IntersectionObserver((entries) => {
    for (const entry of entries) onScreen.get(entry.target)?.(entry.isIntersecting)
  })
  onScreen.set(el, update)
  seen.observe(el)
  return () => {
    seen?.unobserve(el)
    onScreen.delete(el)
  }
}

/**
 * "집계 중…" for a value that is still being gathered (user 10-16, 10-18): a
 * band of light runs across the letters every 1.5 s for as long as the value
 * is pending — a loading sign, so the 5-second rule for motion that starts on
 * its own does not apply; the label goes as soon as the value comes. Only
 * transforms move (see pending-text.css), every label on the page runs on the
 * same beat (the document's time origin), and it pauses off screen or in a
 * hidden tab. The text and its box never change (A7); the "…" is there from
 * the start and is for the eye only. Still with reduced motion, plain text in
 * forced colours. No role of its own: the region around it says it is busy.
 */
function PendingText({ className }: { className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    // The run: from before the text to after it (its width plus the window's).
    el.style.setProperty("--pending-run", `${el.getBoundingClientRect().width}px`)
    let visible = true
    const sync = () => {
      const paused = !visible || document.hidden
      el.toggleAttribute("data-paused", paused)
      if (paused) return
      // Back on the shared beat: every label at the same point of the band.
      for (const animation of el.getAnimations({ subtree: true })) animation.startTime = 0
    }
    const stop = observe(el, (now) => {
      visible = now
      sync()
    })
    document.addEventListener("visibilitychange", sync)
    sync()
    return () => {
      stop()
      document.removeEventListener("visibilitychange", sync)
    }
  }, [])
  return (
    <span ref={ref} data-slot="pending-text" className={cn("pending-text after:[content:'…'_/_'']", className)}>
      집계 중
      <span className="pending-text__window" aria-hidden="true" data-glow="집계 중…" />
    </span>
  )
}

export { PendingText }
