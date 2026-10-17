"use client"
// MIT © 2026 Lorenzo Cabra — https://bencho.dev/blocks/confirm
// Bencho "Inline confirm", kept as published (full licence in ./NOTICE). Our
// changes (#368): framer-motion → motion/react (`m` under LazyMotion, same
// library), Lucide → Iconsax free icons, Korean words, callbacks and labels as
// props, and our tokens mapped on the block root in inline-confirm.css.
import "./inline-confirm.css"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from "motion/react"
import { TickCircle, TrashSquare, UndoArrow } from "@/components/ui/icons"

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const hold = (e: React.PointerEvent) => e.stopPropagation()

/* ══ 4 · confirm in place ═════════════════════════════════
   The button becomes its own dialog. Nothing opens over the
   page, nothing shifts around it, and the choice stays under
   the cursor that asked for it — a modal moves your attention
   somewhere else to answer a question you just asked here.

   Undo lives in the same footprint too, on a timer, so the
   destructive path never needs a toast either. */

const GRACE = 4000

/* 22 is half of the 44px shell — the pill it already is */
const SAY_CORNER = 22

/* ── one pill, two widths ─────────────────────────────────
   "Delete" at rest; pressed, it deletes at once and the same
   pill springs wide to say so and offer Undo. No confirmation
   step: an undo that is right there is kinder than a question,
   because it asks only of the people who changed their mind. */
const SAY_W = 260
const SAY_IDLE = 112
const SAY_DONE = 206

type InlineConfirmProps = {
  corner?: number
  /** Runs at the press; the pill then offers undo for GRACE ms. */
  onConfirm?: () => void
  /** Runs when undo is pressed inside the grace period. */
  onUndo?: () => void
  label?: string
  doneLabel?: string
  undoLabel?: string
}

export function InlineConfirm({
  corner = SAY_CORNER,
  onConfirm,
  onUndo,
  label = "삭제",
  doneLabel = "삭제됨",
  undoLabel = "되돌리기",
}: InlineConfirmProps = {}) {
  const [phase, setPhase] = useState<"idle" | "done">("idle")
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const commit = () => {
    /* the one destructive action on the bench, and the only
       place `land` is used: something has happened and it is
       over. A bright note here would be celebrating a
       delete. */
    setPhase("done")
    onConfirm?.()
    timer.current = window.setTimeout(() => setPhase("idle"), GRACE)
  }
  const undo = () => {
    window.clearTimeout(timer.current)
    setPhase("idle")
    onUndo?.()
  }

  /* out with a little give, back in firmly */
  const done = phase === "done"
  const w = done ? SAY_DONE : SAY_IDLE
  const left = (SAY_W - w) / 2
  const spring = done
    ? { type: "spring" as const, stiffness: 420, damping: 20, mass: 0.9 }
    : { type: "spring" as const, stiffness: 460, damping: 30, mass: 0.9 }
  const r = clamp(corner, 0, SAY_CORNER)

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <div
          className="say-well"
          data-phase={phase}
          style={{ "--say-r": `${r}px` } as React.CSSProperties}
        >
          <m.span className="say-body" initial={false} animate={{ left, width: w }} transition={spring} />

          <AnimatePresence initial={false}>
            {!done && (
              <m.button
                key="idle"
                type="button"
                className="say-face"
                style={{ left, width: w }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.18, delay: 0.08 } }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
                onClick={commit}
                onPointerDown={hold}
              >
                <TrashSquare size={15} aria-hidden />
                {label}
              </m.button>
            )}

            {done && (
              <m.div
                key="done"
                className="say-merged"
                style={{ left, width: w }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.1 } }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
              >
                <span className="say-done" role="status">
                  <TickCircle size={14} aria-hidden />
                  {doneLabel}
                </span>
                {/* the face that had focus is gone; hand it to undo so a
                    keyboard user is not dropped onto <body> */}
                <button type="button" className="say-undo" onClick={undo} onPointerDown={hold} autoFocus>
                  <UndoArrow size={13} aria-hidden />
                  {undoLabel}
                </button>
                <i className="say-fuse" style={{ animationDuration: `${GRACE}ms` }} />
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </MotionConfig>
    </LazyMotion>
  )
}
