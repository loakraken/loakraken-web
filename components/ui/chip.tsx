import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cn } from "cn"

// Toggle chip for presets and quick values (crit-speed buffs, refining
// targets). Base UI's Toggle sets aria-pressed and data-pressed; the chip
// fills with the primary colour while pressed.
const chipClassName = cn(
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full px-3",
  "bg-muted text-(length:--text-meta) text-foreground tabular-nums whitespace-nowrap select-none",
  "transition-[background-color,color,transform] duration-(--duration-fast) ease-(--ease-out)",
  "not-data-disabled:active:scale-(--press-scale)",
  "pointer-fine:not-data-disabled:not-data-pressed:hover:bg-secondary",
  // Colour only: a weight change would reflow the chip row on every toggle.
  "data-pressed:bg-primary data-pressed:text-primary-foreground",
  "data-disabled:cursor-not-allowed",
  "data-disabled:text-faint",
  "[&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0"
)

function Chip({ className, ...props }: TogglePrimitive.Props) {
  return (
    <TogglePrimitive
      data-slot="chip"
      className={cn(chipClassName, className)}
      {...props}
    />
  )
}

export { Chip, chipClassName }
