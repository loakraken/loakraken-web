import { cn } from "cn"

// Grey placeholder while data loads; the only repeating motion allowed on
// information screens (PM decision D2). Size it with className to match the
// content it stands in for, and mark the loading region with aria-busy.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-(--radius-sm) bg-secondary motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

/**
 * A placeholder for one value inside a line of text (a number on a stat card,
 * a price in a row): one line tall in the surrounding font (1lh) and `chars`
 * digits wide (ch), so when the real value arrives in the same spot nothing
 * moves (CLS 0). Pair the card with aria-busy while loading.
 */
function SkeletonValue({ chars = 6, className, ...props }: React.ComponentProps<"span"> & { chars?: number }) {
  return (
    <span
      data-slot="skeleton-value"
      aria-hidden="true"
      style={{ width: `${chars}ch` }}
      className={cn(
        "inline-block h-[1lh] max-w-full animate-pulse rounded-(--radius-xs) bg-secondary align-top tabular-nums motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton, SkeletonValue }
