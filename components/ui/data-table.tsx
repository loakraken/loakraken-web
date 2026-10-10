"use client"

import * as React from "react"
import { cn } from "cn"

// Data tables (swiftness table, refining plan, character detail, market).
// The wrapper scrolls sideways on narrow screens; it is a named region and
// becomes a tab stop only while it actually overflows, so keyboard users can
// scroll it without an extra stop on wide screens. Mark number cells with
// data-numeric (right-aligned tabular figures), the user's own row with
// aria-current="true" (or data-current) and the best row with data-optimal.
type DataTableProps = React.ComponentProps<"table"> & {
  /** Name of the scroll region, read by screen readers (e.g. "신속 스탯별 공이속"). */
  label: string
}

function useOverflowX<T extends HTMLElement>() {
  const ref = React.useRef<T>(null)
  const [overflowing, setOverflowing] = React.useState(false)
  React.useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setOverflowing(element.scrollWidth > element.clientWidth + 1)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    return () => observer.disconnect()
  }, [])
  return [ref, overflowing] as const
}

function DataTable({ label, className, ...props }: DataTableProps) {
  const [ref, overflowing] = useOverflowX<HTMLDivElement>()
  return (
    <div
      ref={ref}
      data-slot="data-table"
      role="region"
      aria-label={label}
      tabIndex={overflowing ? 0 : undefined}
      className="max-w-full min-w-0 overflow-x-auto rounded-(--radius-sm)"
    >
      <table
        className={cn(
          "w-full border-collapse text-(length:--text-body) tabular-nums",
          "[&_caption]:mb-2 [&_caption]:text-left [&_caption]:text-(length:--text-caption) [&_caption]:text-muted-foreground",
          "[&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:whitespace-nowrap",
          "[&_thead_th]:text-(length:--text-caption) [&_thead_th]:text-muted-foreground",
          "[&_thead_th]:border-b [&_thead_th]:border-border",
          "[&_td]:px-3 [&_td]:py-2 [&_td]:whitespace-nowrap",
          "[&_tbody_tr]:border-b [&_tbody_tr]:border-border [&_tbody_tr:last-child]:border-b-0",
          "[&_[data-numeric]]:text-right",
          // The user's own row: a primary tint plus a 3px --ring bar on the
          // first cell (4.70 light, 6.42 dark), so it is not told by colour
          // fill alone; neither changes column widths.
          "[&_tr:is([data-current],[aria-current=true])]:bg-[color-mix(in_oklab,var(--primary)_6%,transparent)]",
          "[&_tr:is([data-current],[aria-current=true])>:first-child]:shadow-[inset_3px_0_0_var(--ring)]",
          "[&_tr[data-optimal]_:is(th,td)]:font-semibold",
          className
        )}
        {...props}
      />
    </div>
  )
}

export { DataTable }
export type { DataTableProps }
