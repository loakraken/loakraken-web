import * as React from "react"
import Link from "next/link"
import { cn } from "cn"

// Page tabs that are links (character detail: 전투 · 스킬 · 아크 패시브 …).
// The current page carries aria-current="page" and a filled pill; the weight
// stays the same so the row does not reflow. The row scrolls sideways on
// narrow screens; 6px padding keeps the 3px+2px focus ring from being clipped.
type TabNavProps = React.ComponentProps<"nav"> & {
  /** Name of the tab set, read by screen readers (e.g. "캐릭터 정보"). */
  label: string
}

function TabNav({ label, className, children, ...props }: TabNavProps) {
  return (
    <nav data-slot="tab-nav" aria-label={label} className={cn("min-w-0", className)} {...props}>
      <ul className="no-scrollbar flex gap-1 overflow-x-auto p-1.5">{children}</ul>
    </nav>
  )
}

type TabLinkProps = React.ComponentProps<typeof Link> & {
  current?: boolean
}

function TabLink({ current = false, className, ...props }: TabLinkProps) {
  return (
    <li className="shrink-0">
      <Link
        data-slot="tab-link"
        aria-current={current ? "page" : undefined}
        className={cn(
          "inline-flex h-9 items-center rounded-full px-3.5 whitespace-nowrap",
          "text-(length:--text-body) tracking-(--tracking-body) text-foreground",
          "transition-[background-color,color] duration-(--duration-fast) ease-(--ease-out)",
          "pointer-fine:not-aria-[current=page]:hover:bg-hover-surface",
          "aria-[current=page]:bg-foreground aria-[current=page]:text-background",
          className
        )}
        {...props}
      />
    </li>
  )
}

export { TabLink, TabNav }
export type { TabLinkProps, TabNavProps }
