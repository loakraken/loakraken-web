import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Flat information surface for tool cards, character panels, market boards and
// home widgets. Surfaces are told apart by fill and spacing, not shadows.
// "card" sits on a --muted band, "muted" on the plain page.
// min-w-0: inside grid/flex parents a wide table must scroll within the panel
// rather than stretch it past the screen.
const panelVariants = cva("min-w-0 rounded-(--radius-lg) text-card-foreground", {
  variants: {
    surface: {
      card: "bg-card",
      muted: "bg-muted",
    },
    padding: {
      md: "p-4 min-[701px]:p-6",
      none: "",
    },
  },
  defaultVariants: {
    surface: "card",
    padding: "md",
  },
})

type PanelProps = React.ComponentProps<"section"> & VariantProps<typeof panelVariants>

function Panel({ className, surface, padding, ...props }: PanelProps) {
  return (
    <section
      data-slot="panel"
      className={cn(panelVariants({ surface, padding }), className)}
      {...props}
    />
  )
}

// Title row with an optional action on the right (e.g. "더보기").
function PanelHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-header"
      className={cn("mb-3 flex min-h-6 items-center justify-between gap-3", className)}
      {...props}
    />
  )
}

// Panel titles follow iloa's 14/700, two pixels up for our wider panels.
function PanelTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="panel-title"
      className={cn(
        "text-(length:--text-heading-sm) leading-(--leading-title) font-bold tracking-(--tracking-title)",
        className
      )}
      {...props}
    />
  )
}

export { Panel, PanelHeader, PanelTitle, panelVariants }
export type { PanelProps }
