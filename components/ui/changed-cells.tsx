"use client"

// Adapted from Motiq "Streaming Data Rows" (MIT, © 2026 Mahammad Rustamov;
// https://21st.dev/@rmahammad/components/streaming-data-rows, see ./NOTICE-motiq).
// Kept: change detection by row id and column, the cell emphasis that fades
// once (it never blinks) with a ▲/▼ that says "changed" without colour alone,
// status pills told by shape + word, and rate-limited screen-reader summaries.
// Changed for LOAKraken (PM 총괄 02:24 ⑤): pieces for our own DataTable rather
// than a second table — no sorting, row actions, stacked cards or animated
// numbers (the number is final at once, user 10-11), no row reordering motion;
// CSS opacity only, our tokens, Korean summaries.

import "./changed-cells.css"
import * as React from "react"
import { cn } from "cn"

type CellValue = string | number | null | undefined
type Pulse = { id: number; dir: -1 | 0 | 1 }

const subscribeReduce = (onChange: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)")
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

/**
 * Which cells changed since the last rows. `cells` names the values to watch,
 * e.g. { price: (r) => r.price }. Returns pulse(rowId, key) for ChangeMark and
 * a short Korean summary for UpdateAnnouncer. The first rows are not "changes".
 */
function useChangedCells<T>(
  rows: readonly T[],
  getRowId: (row: T) => string,
  cells: Record<string, (row: T) => CellValue>,
  { duration = 1400, paused = false, announce = true }: { duration?: number; paused?: boolean; announce?: boolean } = {}
) {
  const read = (list: readonly T[]) => {
    const map = new Map<string, Record<string, CellValue>>()
    for (const row of list) {
      const values: Record<string, CellValue> = {}
      for (const [key, get] of Object.entries(cells)) values[key] = get(row)
      map.set(getRowId(row), values)
    }
    return map
  }
  // Compared during render against the last rows seen (React's "storing
  // information from previous renders"), so a change shows in the same frame
  // as its new value.
  const [snap, setSnap] = React.useState(() => ({
    rows,
    map: read(rows),
    pulses: {} as Record<string, Pulse>,
    seq: 0,
    change: { added: 0, updated: 0, removed: 0 },
  }))
  if (rows !== snap.rows) {
    const next = read(rows)
    const fresh: Record<string, Pulse> = {}
    let seq = snap.seq
    let added = 0
    let updated = 0
    for (const [id, values] of next) {
      const before = snap.map.get(id)
      if (!before) {
        added += 1
        continue
      }
      let changed = false
      for (const [key, v] of Object.entries(values)) {
        const b = before[key]
        if (b === v) continue
        changed = true
        const dir = typeof v === "number" && typeof b === "number" ? (Math.sign(v - b) as -1 | 0 | 1) : 0
        if (!paused) fresh[`${id}:${key}`] = { id: ++seq, dir }
      }
      if (changed) updated += 1
    }
    let removed = 0
    for (const id of snap.map.keys()) if (!next.has(id)) removed += 1
    setSnap({ rows, map: next, pulses: { ...snap.pulses, ...fresh }, seq, change: { added, updated, removed } })
  }

  // Clear each pulse once its emphasis has run (with reduced motion too, where
  // the arrow shows still for the same time and then goes).
  const { pulses, change } = snap
  React.useEffect(() => {
    const ids = Object.entries(pulses)
    if (!ids.length) return
    const timer = window.setTimeout(() => {
      setSnap((current) => {
        const out = { ...current.pulses }
        for (const [k, p] of ids) if (out[k]?.id === p.id) delete out[k]
        return { ...current, pulses: out }
      })
    }, duration)
    return () => window.clearTimeout(timer)
  }, [pulses, duration])

  // One polite summary at most every 1.6s, however often rows arrive.
  const [summary, setSummary] = React.useState("")
  const pending = React.useRef({ added: 0, updated: 0, removed: 0 })
  const flush = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => {
    if (!announce || paused || (!change.added && !change.updated && !change.removed)) return
    const p = pending.current
    p.added += change.added
    p.updated += change.updated
    p.removed += change.removed
    if (flush.current) return
    flush.current = setTimeout(() => {
      flush.current = null
      const { added: a, updated: u, removed: r } = pending.current
      pending.current = { added: 0, updated: 0, removed: 0 }
      const parts = [a && `${a}개 추가`, u && `${u}개 바뀜`, r && `${r}개 빠짐`].filter(Boolean)
      if (parts.length) setSummary(`${parts.join(", ")}.`)
    }, 1600)
  }, [change, announce, paused])
  React.useEffect(
    () => () => {
      if (flush.current) clearTimeout(flush.current)
    },
    []
  )

  const pulse = React.useCallback((rowId: string, key: string) => pulses[`${rowId}:${key}`], [pulses])
  return { pulse, summary }
}

/**
 * Wraps a cell's content. When `pulse` is set, a wash fades out behind it
 * once (opacity only) and ▲/▼ shows the direction for a moment; up and down
 * use the market colours, and the arrow says it without colour too.
 */
function ChangeMark({ pulse, children, className }: { pulse?: Pulse; children: React.ReactNode; className?: string }) {
  const reduce = React.useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  )
  const tone = pulse?.dir === 1 ? "up" : pulse?.dir === -1 ? "down" : "same"
  return (
    <span data-slot="change-mark" data-tone={pulse ? tone : undefined} className={cn("chg", className)}>
      {pulse && !reduce && <span key={`w${pulse.id}`} aria-hidden className="chg-wash" />}
      {children}
      {pulse && pulse.dir !== 0 && (
        <span key={`d${pulse.id}`} aria-hidden className="chg-dir">
          {pulse.dir > 0 ? "▲" : "▼"}
        </span>
      )}
    </span>
  )
}

/** The summary of changes, read out politely and at most once every 1.6s. */
function UpdateAnnouncer({ text }: { text: string }) {
  return (
    <span role="status" className="sr-only">
      {text}
    </span>
  )
}

type PillTone = "positive" | "neutral" | "warning" | "negative"

/** A status told by a shape and a word, never colour alone. */
function StatusPill({ tone = "neutral", children, className }: { tone?: PillTone; children: React.ReactNode; className?: string }) {
  return (
    <span data-slot="status-pill" data-tone={tone} className={cn("chg-pill", className)}>
      <PillGlyph tone={tone} />
      {children}
    </span>
  )
}

function PillGlyph({ tone }: { tone: PillTone }) {
  const common = { width: 11, height: 11, viewBox: "0 0 12 12", "aria-hidden": true, className: "shrink-0" } as const
  if (tone === "positive")
    return (
      <svg {...common} fill="none">
        <path d="M2.5 6.5 5 9l4.5-5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  if (tone === "negative")
    return (
      <svg {...common} fill="none">
        <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  if (tone === "warning")
    return (
      <svg {...common} fill="currentColor">
        <path d="M6 1.5 11 10.5H1z" />
      </svg>
    )
  return (
    <svg {...common} fill="currentColor">
      <circle cx="6" cy="6" r="3" />
    </svg>
  )
}

export { useChangedCells, ChangeMark, UpdateAnnouncer, StatusPill }
export type { Pulse, PillTone }
