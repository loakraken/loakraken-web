import * as React from "react"
import { cn } from "cn"

// Data tables (swiftness table, refining plan, character detail, market).
// The wrapper scrolls sideways on narrow screens; it is a named, focusable
// region so keyboard users can scroll it. Mark number cells with data-numeric
// (right-aligned tabular figures), the user's own row with data-current and
// the best row with data-optimal.
type DataTableProps = React.ComponentProps<"table"> & {
  /** Name of the scroll region, read by screen readers (e.g. "신속 스탯별 공이속"). */
  label: string
}

function DataTable({ label, className, ...props }: DataTableProps) {
  return (
    <div
      data-slot="data-table"
      role="region"
      aria-label={label}
      tabIndex={0}
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
          // The user's own row: a primary tint that shows on any surface and
          // does not change column widths; data-optimal marks the best row.
          "[&_tr[data-current]]:bg-[color-mix(in_oklab,var(--primary)_6%,transparent)]",
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
