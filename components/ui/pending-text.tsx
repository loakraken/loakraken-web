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

// Chrome turns every CSS animation's start and each 1.5 s turn into a DOM event,
// and React, listening at its root, walks every one. On the shared beat all
// labels turn on the same frame (40 labels: 80 events), and that frame was the
// one over 50 ms under a 4× slowdown (CI, 11-09). Nothing reads these events
// from inside a label, so one listener stops them before they reach React.
let quiet = false
const quietAnimationEvents = () => {
  if (quiet) return
  quiet = true
  const stop = (event: Event) => {
    if ((event.target as Element | null)?.closest?.('[data-slot="pending-text"]')) event.stopPropagation()
  }
  window.addEventListener("animationstart", stop, true)
  window.addEventListener("animationiteration", stop, true)
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
    quietAnimationEvents()
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
      <span className="pending-text__window" aria-hidden="true">
        {/* The copy moves on an element of its own: Chrome re-styles every
            running animation on each main frame, and a pseudo-element's costs
            more (40 labels under a 4× slowdown: long tasks, #900). The drawn
            text sits one level further in: a pseudo-element on the moving
            element is re-styled with it on every frame, one on a still child
            is not (a third of each frame's style work with 40 labels). */}
        <span className="pending-text__glow">
          <span className="pending-text__copy" data-glow="집계 중…" />
        </span>
      </span>
    </span>
  )
}

export { PendingText }
