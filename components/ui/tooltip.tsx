"use client"

import { createContext, useContext, useRef, useState } from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "cn"

// Touch (web #1984): Base UI's tooltip opens on hover and keyboard focus only, and a tap cancels a pending open, so a
// term's explanation could not be read on a phone. Here a tap on the trigger toggles it; a tap outside or Escape closes
// it. Mouse and keyboard behave as before. No trigger in the app has an action of its own (checked when this landed).
type TouchToggle = { tapped: () => void; pressed: (touch: boolean) => void; cancelled: () => void }
const TouchToggleContext = createContext<TouchToggle | null>(null)

function TooltipProvider({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
}

function Tooltip({ open, defaultOpen, onOpenChange, ...props }: TooltipPrimitive.Root.Props) {
  const [own, setOwn] = useState(defaultOpen ?? false)
  const controlled = open !== undefined
  const shown = controlled ? open : own
  // Set on a touch pointerdown on the trigger, cleared once its tap is handled: Base UI's own reaction to that press
  // (closing, or cancelling an open) is left to the tap's toggle.
  const touching = useRef(false)
  const change: NonNullable<TooltipPrimitive.Root.Props["onOpenChange"]> = (next, details) => {
    if (touching.current && details.reason === "trigger-press") return
    if (!controlled) setOwn(next)
    onOpenChange?.(next, details)
  }
  const toggle: TouchToggle = {
    // Every press sets it from its own pointer (web #1995): a mouse or pen press after a touch that never ended in a
    // click (a scroll) clears it, so that click closes the tooltip as usual on a touch-and-mouse device.
    pressed: (touch) => {
      touching.current = touch
    },
    cancelled: () => {
      touching.current = false
    },
    // An uncontrolled tooltip only (every one in the app): a controlled one keeps its owner's open state. Flipped from
    // the latest state, and the guard held until this click is fully handled (web #1995): cleared at once, Base UI's
    // own press-close for the same click (still attached while the popup animates out) closed a quick re-tap again.
    tapped: () => {
      if (!controlled) setOwn((was) => !was)
      setTimeout(() => {
        touching.current = false
      }, 0)
    },
  }
  return (
    <TouchToggleContext.Provider value={toggle}>
      <TooltipPrimitive.Root data-slot="tooltip" open={shown} onOpenChange={change} {...props} />
    </TouchToggleContext.Provider>
  )
}

function TooltipTrigger({ onPointerDown, onPointerCancel, onClick, ...props }: TooltipPrimitive.Trigger.Props) {
  const touch = useContext(TouchToggleContext)
  const touched = useRef(false)
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      onPointerDown={(event) => {
        touched.current = event.pointerType === "touch"
        touch?.pressed(touched.current)
        onPointerDown?.(event)
      }}
      // A touch that turned into a scroll: no click follows, so nothing is left marked (web #1995).
      onPointerCancel={(event) => {
        touched.current = false
        touch?.cancelled()
        onPointerCancel?.(event)
      }}
      onClick={(event) => {
        onClick?.(event)
        if (touched.current) {
          touched.current = false
          touch?.tapped()
        }
      }}
      {...props}
    />
  )
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        {/* A dark translucent glass panel in both themes,
            12px radius, 12/14 padding, 12px text, no arrow. A second line
            can use text-(--tooltip-muted). At most 20rem, and never wider
            than the screen less its margins (#1941: at 320 a 20rem panel was
            the whole width, and a long one stuck out 5px). */}
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 grid w-fit max-w-[min(20rem,calc(100vw-1rem))] origin-(--transform-origin) gap-0.5 rounded-(--radius-md) px-3.5 py-3",
            "bg-(--tooltip) text-(length:--text-caption) leading-[1.35] font-medium text-(--tooltip-foreground)",
            "backdrop-blur-[24px] backdrop-saturate-[1.8] shadow-(--tooltip-shadow)",
            "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
