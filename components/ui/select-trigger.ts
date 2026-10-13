import { cn } from "cn"
import { fieldClassName } from "@/components/ui/input"

/** The closed field, shared by the light trigger and the full select so the
 * swap between them changes nothing on screen. */
export const triggerClassName = (size: "md" | "lg", className?: string) =>
  cn(
    fieldClassName,
    "inline-flex w-full min-w-0 items-center justify-between gap-2 text-left",
    size === "lg" ? "h-11 pr-3 pl-4" : "h-9 pr-2.5 pl-3",
    "cursor-default data-popup-open:border-(--ring)",
    // Pressed: the field tints at once, before the list opens (apple-design:
    // feedback on pointer-down; a touch opens the list only on release). Drawn
    // as an overlay: several screens set the field's background in their own
    // (unlayered) CSS, which a background utility cannot win against.
    "relative before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-hover-surface before:opacity-0 before:content-['']",
    "before:transition-opacity before:duration-(--duration-fast) not-data-disabled:active:before:opacity-100",
    className
  )
