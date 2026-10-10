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

export { Skeleton }
