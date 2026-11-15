"use client"

import * as React from "react"
import { ArrowLeft2, ArrowRight2 } from "@/components/ui/icons"
import { clearOfFade } from "@/components/ui/focus-clear-of-fade"
import { useNonce } from "@/components/site/nonce"

// One behaviour for every row of chips or tabs that scrolls sideways (user 11-16: the /market
// category row was cut off on a desktop with no way to reach the rest). The row's FIRST element
// child is the scroller; this box only adds to it:
//
// - ‹ › buttons over the row's ends, on a mouse or trackpad only (hover: hover, pointer: fine),
//   each shown only while items are hidden past its end; a press scrolls about one row.
// - Dragging with the mouse scrolls the row. Past a few px it is a drag, and the press then
//   chooses nothing (its click is swallowed); a press that stays put is an ordinary click.
//   Navigation rows only (chips, tabs): a row of content people copy from (compare cards) passes
//   drag={false} and keeps text selection; it still has ‹ ›, the fades and native scrolling.
// - A tab reached by keyboard rests clear of the end fades (clearOfFade).
// - With `reveal`, the chosen item is in view from the first HTML (a tiny inline script right
//   after the row, every browser) and again whenever `revealKey` changes.
//
// Touch swipe, trackpad and shift+wheel stay the browser's own: nothing here reads the wheel or
// a touch. The buttons are overlays, not drawn at all (display: none) until the row is measured as
// hiding items past that end, so they never move anything while a page arrives (A7). A row whose
// scroller sits off this box's edges (negative margins for its focus room) says where with
// --row-start / --row-end / --row-top / --row-bottom in its own CSS.
//
// <OverflowRow as="nav" aria-label="…" reveal="[aria-current=page]">
//   <div className="overflow-x-auto …">…items…</div>
// </OverflowRow>

/** Past this many px a mouse press is a drag, not a click. */
const DRAG_PX = 6

type OverflowRowProps = React.HTMLAttributes<HTMLElement> & {
  as?: "div" | "nav"
  /** A selector for the chosen item inside the row, brought into view (first paint, `revealKey`). */
  reveal?: string
  /** Brings the chosen item into view again when it changes (a choice made elsewhere, Back). */
  revealKey?: unknown
  /**
   * The inline script that reveals the chosen item while the server's HTML is parsed. Off for a row
   * only the browser draws (read from storage): a script React adds there never runs.
   */
  revealScript?: boolean
  /** Mouse drag scrolls the row (navigation rows). false: a row of text to select and copy. */
  drag?: boolean
}

// The chosen item, clear of the row's scroll-padding (its end fades). Runs as the server's HTML
// is parsed (an inline script, so it must stand alone) and again after a move inside the app.
function revealChosen(row: Element | null, selector: string) {
  if (!(row instanceof HTMLElement) || row.scrollWidth <= row.clientWidth) return
  const item = row.querySelector(selector)
  if (!item) return
  const style = getComputedStyle(row)
  const padStart = parseFloat(style.scrollPaddingLeft) || 0
  const padEnd = parseFloat(style.scrollPaddingRight) || 0
  const left = row.getBoundingClientRect().left + row.clientLeft
  const rect = item.getBoundingClientRect()
  const start = rect.left - left - padStart
  const end = rect.right - (left + row.clientWidth) + padEnd
  if (start < 0) row.scrollLeft += start
  else if (end > 0) row.scrollLeft += end
}
const REVEAL = (selector: string) =>
  `(${revealChosen.toString()})(document.currentScript.parentElement.firstElementChild,${JSON.stringify(selector)})`

function OverflowRow({
  as: Tag = "div",
  reveal,
  revealKey,
  revealScript = true,
  drag: draggable = true,
  className,
  children,
  ...props
}: OverflowRowProps) {
  const box = React.useRef<HTMLElement>(null)
  const nonce = useNonce()

  React.useLayoutEffect(() => {
    if (reveal) revealChosen(box.current?.firstElementChild ?? null, reveal)
  }, [reveal, revealKey])

  React.useEffect(() => {
    const root = box.current
    const row = root?.firstElementChild
    if (!root || !(row instanceof HTMLElement)) return

    // Which ends hide items.
    let frame = 0
    const read = () => {
      frame = 0
      const overflow = row.scrollWidth > row.clientWidth + 1
      flag(root, "data-overflow-start", overflow && row.scrollLeft > 1)
      flag(root, "data-overflow-end", overflow && row.scrollLeft + row.clientWidth < row.scrollWidth - 1)
    }
    const later = () => {
      if (!frame) frame = requestAnimationFrame(read)
    }
    read()
    const sizes = new ResizeObserver(later)
    const watch = () => {
      sizes.disconnect()
      sizes.observe(root)
      sizes.observe(row)
      for (const child of row.children) sizes.observe(child)
    }
    watch()
    // Items added or removed (a favourite saved) change what overflows.
    const items = new MutationObserver(() => {
      watch()
      later()
    })
    items.observe(row, { childList: true })
    row.addEventListener("scroll", later, { passive: true })

    // A keyboard focus rests clear of the end fades; a mouse or touch press never moves the row.
    const focus = (event: FocusEvent) => {
      const item = event.target
      if (item instanceof HTMLElement && item !== row && item.matches(":focus-visible")) clearOfFade(row, item)
    }
    row.addEventListener("focusin", focus)

    // Drag to scroll, mouse only (touch and pen scroll natively).
    let drag: { id: number; x: number; left: number; moved: boolean } | null = null
    const swallow = (event: MouseEvent) => {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    const down = (event: PointerEvent) => {
      if (!draggable || event.pointerType !== "mouse" || event.button !== 0 || row.scrollWidth <= row.clientWidth + 1) return
      drag = { id: event.pointerId, x: event.clientX, left: row.scrollLeft, moved: false }
    }
    const move = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return
      if (!(event.buttons & 1)) return end(event)
      const dx = event.clientX - drag.x
      if (!drag.moved) {
        if (Math.abs(dx) < DRAG_PX) return
        drag.moved = true
        row.setPointerCapture(event.pointerId)
        root.setAttribute("data-dragging", "")
        window.getSelection()?.removeAllRanges()
      }
      row.scrollLeft = drag.left - dx
    }
    const end = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return
      const moved = drag.moved
      drag = null
      root.removeAttribute("data-dragging")
      if (row.hasPointerCapture(event.pointerId)) row.releasePointerCapture(event.pointerId)
      // The click that ends a drag chooses nothing. It follows this pointerup in the same task.
      if (moved && event.type === "pointerup") {
        row.addEventListener("click", swallow, { capture: true, once: true })
        setTimeout(() => row.removeEventListener("click", swallow, { capture: true }))
      }
    }
    // A link or image dragged out of a row that scrolls would start the browser's own drag.
    const dragstart = (event: DragEvent) => {
      if (draggable && row.scrollWidth > row.clientWidth + 1) event.preventDefault()
    }
    row.addEventListener("pointerdown", down)
    row.addEventListener("pointermove", move)
    row.addEventListener("pointerup", end)
    row.addEventListener("pointercancel", end)
    row.addEventListener("lostpointercapture", end)
    row.addEventListener("dragstart", dragstart)

    return () => {
      cancelAnimationFrame(frame)
      sizes.disconnect()
      items.disconnect()
      row.removeEventListener("scroll", later)
      row.removeEventListener("focusin", focus)
      row.removeEventListener("pointerdown", down)
      row.removeEventListener("pointermove", move)
      row.removeEventListener("pointerup", end)
      row.removeEventListener("pointercancel", end)
      row.removeEventListener("lostpointercapture", end)
      row.removeEventListener("dragstart", dragstart)
      row.removeEventListener("click", swallow, { capture: true })
      root.removeAttribute("data-dragging")
    }
  }, [draggable])

  return (
    // data-overflow-row marks the box even when the caller names its own data-slot.
    <Tag ref={box as React.Ref<never>} data-slot="overflow-row" {...props} data-overflow-row="" className={className}>
      {children}
      {reveal && revealScript && <script nonce={nonce} dangerouslySetInnerHTML={{ __html: REVEAL(reveal) }} suppressHydrationWarning />}
      {/* Mouse only, and the keyboard reaches every item by Tab (which scrolls the row), so the
          buttons stay out of the Tab order; a press never takes the focus. */}
      <button
        type="button"
        data-overflow-arrow="prev"
        aria-label="이전 항목"
        tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => turn(event.currentTarget, -1)}
      >
        <ArrowLeft2 size={16} />
      </button>
      <button
        type="button"
        data-overflow-arrow="next"
        aria-label="다음 항목"
        tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => turn(event.currentTarget, 1)}
      >
        <ArrowRight2 size={16} />
      </button>
    </Tag>
  )
}

// About one row's width, less a little so the item at the edge stays in view. `button` is one of
// the ‹ › buttons, whose box's first element child is the row.
function turn(button: HTMLElement, direction: 1 | -1) {
  const row = button.parentElement?.firstElementChild
  if (!(row instanceof HTMLElement)) return
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  row.scrollBy({ left: direction * Math.max(row.clientWidth * 0.8, 64), behavior: calm ? "instant" : "smooth" })
}

function flag(element: HTMLElement, name: string, on: boolean) {
  if (element.hasAttribute(name) !== on) element.toggleAttribute(name, on)
}

export { OverflowRow }
export type { OverflowRowProps }
