import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "cn"

// Show/hide block on native <details>: works without JavaScript, announces
// expanded/collapsed by itself, and opens for in-page search (find-in-page).
type DisclosureProps = Omit<React.ComponentProps<"details">, "title"> & {
  summary: React.ReactNode
}

function Disclosure({ summary, className, children, ...props }: DisclosureProps) {
  return (
    <details data-slot="disclosure" className={cn("group", className)} {...props}>
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-3 rounded-(--radius-sm) py-2 select-none",
          "text-(length:--text-body) font-semibold [&::-webkit-details-marker]:hidden"
        )}
      >
        <span className="min-w-0">{summary}</span>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-faint transition-transform duration-(--duration-base) ease-(--ease-out) group-open:rotate-180"
        />
      </summary>
      <div className="pt-1 pb-2">{children}</div>
    </details>
  )
}

export { Disclosure }
export type { DisclosureProps }
