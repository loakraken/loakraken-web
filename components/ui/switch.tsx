"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "cn"

// On/off setting (party buffs, assumptions). The "on" track is --switch-on
// (3:1 against the page); the "off" track keeps a 1px --input outline so the
// control's edge stays visible. Label it with a <label> or aria-label.
// 44 wide, and 44 tall to press on phones (hit-44, A36).
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "hit-44 relative inline-flex h-[26px] w-11 shrink-0 items-center rounded-full p-0.5",
        "bg-secondary shadow-[inset_0_0_0_1px_var(--input)]",
        "transition-[background-color,box-shadow] duration-(--duration-base) ease-(--ease-out)",
        "data-checked:bg-switch-on data-checked:shadow-none",
        "data-disabled:cursor-not-allowed data-disabled:opacity-40",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "size-[22px] rounded-full bg-white shadow-(--shadow-thumb)",
          "transition-transform duration-(--duration-base) ease-(--ease-sheet)",
          "data-checked:translate-x-[18px]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
