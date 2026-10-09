import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "cn"
import { fieldClassName } from "@/components/ui/input"

// Native <select>: keeps the platform picker on phones and full keyboard
// support. Styled like Input, with a chevron that does not take pointer events.
type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  size?: "md" | "lg"
}

function NativeSelect({ className, size = "md", ...props }: NativeSelectProps) {
  return (
    <span data-slot="native-select" className="relative inline-flex w-full min-w-0">
      <select
        className={cn(
          fieldClassName,
          "appearance-none pr-9",
          size === "lg" ? "h-11 pl-4" : "h-9 pl-3",
          className
        )}
        {...props}
      />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-faint"
      />
    </span>
  )
}

export { NativeSelect }
export type { NativeSelectProps }
