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
    className
  )
