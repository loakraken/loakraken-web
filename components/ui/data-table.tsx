"use client"

import * as React from "react"
import { cn } from "cn"
import { ArrowDown, ArrowUp } from "@/components/ui/icons"

// Data tables (swiftness table, refining plan, character detail, market).
// The wrapper scrolls sideways on narrow screens; it is a named region and
// becomes a tab stop only while it actually overflows, so keyboard users can
// scroll it without an extra stop on wide screens. Mark number cells with
// data-numeric (right-aligned tabular figures), the user's own row with
// aria-current="true" (or data-current) and the best row with data-optimal.
type DataTableProps = React.ComponentProps<"table"> & {
  /** Name of the scroll region, read by screen readers (e.g. "신속 스탯별 공이속"). */
  label: string
  /**
   * Keep the first column in place while the rest scrolls sideways (rankings,
   * multi-search on a phone: the name stays readable). It takes the panel's
   * colour (--table-bg, default --card) so rows do not show through.
   */
  stickyFirst?: boolean
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

function DataTable({ label, stickyFirst = false, className, ...props }: DataTableProps) {
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
          stickyFirst && [
            "[&_:is(th,td):first-child]:sticky [&_:is(th,td):first-child]:left-0 [&_:is(th,td):first-child]:z-1",
            "[&_:is(th,td):first-child]:bg-(--table-bg,var(--card)) [&_:is(th,td):first-child]:shadow-[1px_0_0_var(--border)]",
            // a long name may not take the screen: 40% at most, the rest ellipsised
            // (one line: an ellipsis only works on unwrapped text — give the cell
            // a title when the full name matters)
            "[&_:is(th,td):first-child]:max-w-[40vw] [&_:is(th,td):first-child]:overflow-hidden [&_:is(th,td):first-child]:text-ellipsis [&_:is(th,td):first-child]:whitespace-nowrap",
          ],
          className
        )}
        {...props}
      />
    </div>
  )
}

type SortDir = "asc" | "desc"
type SortState<K extends string> = { key: K; dir: SortDir } | null

/**
 * Sort rows by the column a header points at. Numbers sort as numbers,
 * text by Korean collation; empty values (null) always go last. Stable, and
 * the caller's array is never changed.
 */
function useTableSort<T, K extends string>(
  rows: readonly T[],
  accessors: Record<K, (row: T) => number | string | null | undefined>,
  // the column names come from `accessors`; `initial` must use one of them
  initial: NoInfer<SortState<K>> = null
) {
  const [sort, setSort] = React.useState<SortState<K>>(initial)
  const sorted = React.useMemo(() => {
    if (!sort) return rows
    const get = accessors[sort.key]
    const factor = sort.dir === "asc" ? 1 : -1
    return rows
      .map((row, index) => ({ row, index, v: get(row) }))
      .sort((a, b) => {
        const an = a.v == null || a.v === ""
        const bn = b.v == null || b.v === ""
        if (an || bn) return an === bn ? a.index - b.index : an ? 1 : -1
        const d =
          typeof a.v === "number" && typeof b.v === "number"
            ? a.v - b.v
            : String(a.v).localeCompare(String(b.v), "ko-KR", { numeric: true })
        return d === 0 ? a.index - b.index : d * factor
      })
      .map((entry) => entry.row)
    // accessors are the caller's lookup table (often a new object each render);
    // only the rows and the chosen sort decide the order
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort])
  /** First press on a column uses its first direction (numbers: high first). */
  const toggle = React.useCallback((key: K, first: SortDir = "desc") => {
    setSort((current) =>
      current?.key === key ? { key, dir: current.dir === "desc" ? "asc" : "desc" } : { key, dir: first }
    )
  }, [])
  return { sorted, sort, toggle, setSort }
}

type SortHeaderProps<K extends string> = Omit<React.ComponentProps<"th">, "onClick"> & {
  sortKey: K
  sort: SortState<K>
  onSort: (key: K, first?: SortDir) => void
  /** A number column: right-aligned like its cells. */
  numeric?: boolean
  /** Direction of the first press: high-to-low for numbers, A→Z (가→하)
   *  for words unless set. */
  first?: SortDir
}

/**
 * A sortable column header: the whole label is a button (Enter / Space), the
 * th carries aria-sort, and the arrow shows the direction. Unsorted columns
 * show no arrow; the button's name is the column's name.
 */
function SortHeader<K extends string>({ sortKey, sort, onSort, numeric, first, className, children, ...props }: SortHeaderProps<K>) {
  const dir = sort?.key === sortKey ? sort.dir : null
  return (
    <th
      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
      data-numeric={numeric || undefined}
      className={cn("p-0!", className)}
      {...props}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey, first ?? (numeric ? "desc" : "asc"))}
        className={cn(
          "inline-flex min-h-9 w-full items-center gap-1 px-3 py-2 font-[inherit] whitespace-nowrap",
          numeric && "justify-end",
          dir ? "text-foreground" : "text-muted-foreground",
          "pointer-fine:hover:text-foreground",
          "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ring)"
        )}
      >
        {children}
        <span aria-hidden className="inline-grid size-3.5 place-items-center">
          {dir === "asc" ? <ArrowUp size={14} /> : dir === "desc" ? <ArrowDown size={14} /> : null}
        </span>
      </button>
    </th>
  )
}

export { DataTable, SortHeader, useTableSort }
export type { DataTableProps, SortDir, SortState, SortHeaderProps }
