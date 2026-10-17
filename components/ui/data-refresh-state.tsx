"use client"

// Adapted from Motiq "Data Refresh State" (MIT, © 2026 Mahammad Rustamov;
// https://21st.dev/@rmahammad/components/data-refresh-state, see ./NOTICE-motiq).
// Kept: its state model (idle · refreshing · success · stale · offline · error)
// and the rule that every state is said in words, not colour alone. Changed for
// LOAKraken: one compact row (no panel, interval picker, pause or cancel), our
// tokens and Iconsax icon, no animated numbers, motion = the icon's rotation only
// (transform), and the 30 s cooldown that matches the backend cache.

import * as React from "react"
import { cn } from "cn"
import { RefreshArrow } from "@/components/ui/icons"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { remainingText } from "@/lib/time/remaining"

type RefreshState = "idle" | "refreshing" | "success" | "stale" | "offline" | "error"

const subscribeSecond = (onTick: () => void) => {
  const id = window.setInterval(onTick, 1000)
  return () => window.clearInterval(id)
}
const subscribeReduce = (onChange: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)")
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}
const subscribeOnline = (onChange: () => void) => {
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

/** Time since `at` as the line reads it: seconds under a minute, then minutes, then hours. */
function agoText(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}초 전`
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  return `${Math.floor(s / 3600)}시간 전`
}

// Words first; the dot only repeats them in colour.
const STATE: Record<RefreshState, { word: string; dot: string }> = {
  idle: { word: "", dot: "bg-transparent" },
  refreshing: { word: "갱신 중", dot: "bg-(--link)" },
  success: { word: "갱신됨", dot: "bg-(--success)" },
  stale: { word: "오래된 값", dot: "bg-(--accent-warm)" },
  offline: { word: "오프라인", dot: "bg-(--faint)" },
  error: { word: "갱신 실패", dot: "bg-(--destructive)" },
}

type DataRefreshStateProps = {
  /** When the shown data arrived (ms), e.g. TanStack Query's dataUpdatedAt; 0 = not yet. */
  updatedAt: number
  /** A request (manual or automatic) is in flight. */
  fetching: boolean
  /** The last request failed (the shown data, if any, is older). */
  failed?: boolean
  onRefresh: () => void
  /** Rest after data arrives before the button works again (backend cache: 30 s). */
  cooldown?: number
  /** Older than this the values are called stale (default 10 min). */
  staleAfter?: number
  /** The button's name, e.g. "시세 갱신". */
  label?: string
  className?: string
}

/**
 * "마지막 갱신 N초 전 · 상태" and a refresh button, for a board that also
 * refreshes on its own. The button asks the same query again and rests for
 * `cooldown` after data arrives — sooner would return the same numbers and
 * spend the official API quota. While resting or fetching it stays focusable
 * (aria-disabled) and its tooltip says why. Only state changes are announced
 * (role=status); the ticking "N초 전" is not a live region.
 */
function DataRefreshState({
  updatedAt,
  fetching,
  failed = false,
  onRefresh,
  cooldown = 30_000,
  staleAfter = 600_000,
  label = "새로 고침",
  className,
}: DataRefreshStateProps) {
  // A one-second clock while this is on screen; the server draws 0.
  const now = React.useSyncExternalStore(subscribeSecond, () => Math.floor(Date.now() / 1000) * 1000, () => 0)
  const reduce = React.useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  )
  const online = React.useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)

  // "갱신됨" shows for a moment after new data, then the row goes quiet.
  const [justUpdated, setJustUpdated] = React.useState(false)
  const firstUpdate = React.useRef(updatedAt)
  React.useEffect(() => {
    if (!updatedAt || updatedAt === firstUpdate.current) return
    setJustUpdated(true)
    const id = window.setTimeout(() => setJustUpdated(false), 2500)
    return () => window.clearTimeout(id)
  }, [updatedAt])

  const known = updatedAt > 0 && now > 0
  const state: RefreshState = !online
    ? "offline"
    : fetching
      ? "refreshing"
      : failed
        ? "error"
        : known && now - updatedAt > staleAfter
          ? "stale"
          : justUpdated
            ? "success"
            : "idle"
  const rest = known ? updatedAt + cooldown - now : 0
  const resting = rest > 0
  const blocked = fetching || resting || !online
  const wait = resting ? remainingText(rest) : null
  const tip = !online
    ? "인터넷 연결이 없어요"
    : fetching
      ? "갱신하고 있어요"
      : wait
        ? `${wait} 뒤에 다시 할 수 있어요`
        : label

  return (
    <div data-slot="data-refresh-state" data-state={state} className={cn("inline-flex items-center gap-1.5", className)}>
      {/* One fixed width for the words: "마지막 갱신 59초 전" and the longest state
          word fit, so the row never moves as the clock ticks or a state comes
          and goes (PM-프론트 #575 review, A7: it shifted 36px). */}
      <span className="inline-flex w-[15em] shrink-0 items-center justify-end gap-1.5 text-(length:--text-caption) tabular-nums text-muted-foreground">
        {known && <span>마지막 갱신 {agoText(now - updatedAt)}</span>}
        {/* Announced when it changes; empty when idle. */}
        <span role="status" className="inline-flex w-[5.25em] shrink-0 items-center gap-1">
          {STATE[state].word && (
            <>
              <span aria-hidden className={cn("size-1.5 rounded-full", STATE[state].dot)} />
              {STATE[state].word}
            </>
          )}
        </span>
      </span>
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label={label}
          aria-busy={fetching || undefined}
          aria-disabled={blocked || undefined}
          onClick={() => {
            if (!blocked) onRefresh()
          }}
          className={cn(
            "inline-grid size-11 shrink-0 place-items-center rounded-full text-foreground",
            "transition-[background-color,transform,scale] duration-(--duration-fast) ease-(--ease-out)",
            "pointer-fine:not-aria-disabled:hover:bg-hover-surface not-aria-disabled:active:scale-(--press-scale)",
            "aria-disabled:cursor-default aria-disabled:text-faint",
            "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)"
          )}
        >
          {/* Turns while a request is in flight (transform only); with reduced
              motion it holds still and the status word says 갱신 중. */}
          <RefreshArrow
            size={18}
            aria-hidden
            className={cn(fetching && !reduce && "animate-spin [animation-duration:800ms]")}
          />
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </div>
  )
}

export { DataRefreshState, agoText }
export type { RefreshState, DataRefreshStateProps }
