import * as React from "react"
import { cn } from "cn"
import { Box, InfoCircle, RotateLeft, Warning } from "@/components/ui/icons"

// One way to say "there is nothing here, and why" (PM 총괄 10-12 04:58 ①).
// The user's rules it carries: every empty or skipped place says WHY in one
// sentence (A21, A23 — never ask the user for a value we cannot get, say we
// left it out); no vague hedges (B2); no source or site names (A13).
// The look follows our own cards (21st EmptyState was "shape only").
//
// kinds — the icon and the default title; the sentence is always the caller's:
//   empty        nothing to show yet          "기록이 아직 없어요"
//   skipped      we do not compute this       "계산하지 않는 항목이에요"
//   coming       not open yet                 "준비 중이에요"
//   failed       could not load (+ retry)     "불러오지 못했어요"
// size "row" sits inside a list or table cell; "block" fills a panel.

type EmptyKind = "empty" | "skipped" | "coming" | "failed"

const KIND: Record<EmptyKind, { icon: typeof Box; title: string }> = {
  empty: { icon: Box, title: "기록이 아직 없어요" },
  skipped: { icon: InfoCircle, title: "계산하지 않는 항목이에요" },
  coming: { icon: InfoCircle, title: "준비 중이에요" },
  failed: { icon: Warning, title: "불러오지 못했어요" },
}

type EmptyStateProps = Omit<React.ComponentProps<"div">, "title"> & {
  kind?: EmptyKind
  /** Overrides the kind's title. */
  title?: React.ReactNode
  /** The one sentence that says why (required: an empty state without a reason is the fault). */
  reason: React.ReactNode
  /** e.g. a link to the tool that fills this, or a retry button (see onRetry). */
  action?: React.ReactNode
  /** For kind "failed": shows a 다시 시도 button. */
  onRetry?: () => void
  size?: "row" | "block"
}

function EmptyState({
  kind = "empty",
  title,
  reason,
  action,
  onRetry,
  size = "block",
  className,
  ...props
}: EmptyStateProps) {
  const Icon = KIND[kind].icon
  const row = size === "row"
  return (
    <div
      data-slot="empty-state"
      data-kind={kind}
      // a failure is announced; a plain empty list is just read in place
      role={kind === "failed" ? "alert" : undefined}
      className={cn(
        "text-muted-foreground",
        row
          ? "flex items-start gap-2 py-2 text-(length:--text-caption)"
          : "grid justify-items-center gap-1.5 px-4 py-8 text-center text-(length:--text-body)",
        className
      )}
      {...props}
    >
      <Icon
        size={row ? 16 : 24}
        aria-hidden
        className={cn("shrink-0", row ? "mt-px" : "mb-1", kind === "failed" ? "text-(--destructive)" : "text-faint")}
      />
      <div className={cn("grid gap-0.5", row ? "min-w-0" : "max-w-[34em] justify-items-center")}>
        <p className={cn("text-foreground", row ? "font-medium" : "font-semibold")}>{title ?? KIND[kind].title}</p>
        <p>{reason}</p>
        {(action || onRetry) && (
          <div className={cn("flex flex-wrap items-center gap-2", row ? "mt-1" : "mt-2 justify-center")}>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-(length:--text-caption) font-medium text-foreground",
                  "shadow-[inset_0_0_0_1px_var(--border)] pointer-fine:hover:bg-hover-surface",
                  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)"
                )}
              >
                <RotateLeft size={14} aria-hidden />
                다시 시도
              </button>
            )}
            {action}
          </div>
        )}
      </div>
    </div>
  )
}

export { EmptyState }
export type { EmptyKind, EmptyStateProps }
