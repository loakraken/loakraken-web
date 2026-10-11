"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "cn"
import { ChevronDown, TickCircle } from "@/components/ui/icons"
import { triggerClassName } from "@/components/ui/select-trigger"

// The full select (Base UI Select): list, keyboard, typeahead. Loaded by
// select.tsx the first time the pointer or focus reaches a field, so routes
// pay for it only when someone uses a list.

type Option<V> = { value: V; label: React.ReactNode; disabled?: boolean }

type SelectProps<V extends string | number> = {
  /** Open on mount (used when the light trigger in select.tsx hands over). */
  defaultOpen?: boolean
  value: V
  onValueChange: (value: V) => void
  items: readonly Option<V>[]
  id?: string
  name?: string
  disabled?: boolean
  size?: "md" | "lg"
  className?: string
  "aria-label"?: string
  "aria-labelledby"?: string
  "aria-describedby"?: string
}

function SelectFull<V extends string | number>({
  defaultOpen,
  value,
  onValueChange,
  items,
  id,
  name,
  disabled,
  size = "md",
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  "aria-describedby": ariaDescribedby,
}: SelectProps<V>) {
  return (
    <SelectPrimitive.Root
      defaultOpen={defaultOpen}
      value={value}
      onValueChange={(next) => onValueChange(next as V)}
      items={items.map((item) => ({ value: item.value, label: item.label }))}
      name={name}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        data-slot="select"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        className={triggerClassName(size, className)}
      >
        <SelectPrimitive.Value className="min-w-0 truncate" />
        <SelectPrimitive.Icon className="shrink-0 text-faint transition-transform duration-(--duration-fast) ease-(--ease-out) data-popup-open:rotate-180 motion-reduce:transition-none">
          <ChevronDown size={16} aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={6} collisionPadding={12} className="isolate z-50 outline-none">
          <SelectPrimitive.Popup
            data-slot="select-popup"
            className={cn(
              "max-h-[min(var(--available-height),320px)] min-w-(--anchor-width) overflow-y-auto overscroll-contain p-1",
              // Base UI hides the list scrollbar inline; show the thin site bar, kept
              // off the rounded corners.
              "[scrollbar-width:auto]! [--scrollbar-inset:var(--radius-md)]",
              // focus shows on the highlighted item, not as a ring round the list
              "outline-none",
              "rounded-(--radius-md) bg-(--surface-panel) text-foreground shadow-(--shadow-card) ring-1 ring-(--border)",
              "origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-(--ease-out)",
              "data-starting-style:scale-[0.98] data-starting-style:opacity-0",
              "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-100",
              "motion-reduce:transition-none"
            )}
          >
            {items.map((item) => (
              <SelectPrimitive.Item
                key={String(item.value)}
                value={item.value}
                disabled={item.disabled}
                className={cn(
                  "grid min-h-9 cursor-default grid-cols-[1fr_16px] items-center gap-3 rounded-(--radius-sm) px-3 py-1.5 select-none",
                  "text-(length:--text-body) outline-none",
                  "data-highlighted:bg-muted data-[selected]:font-semibold",
                  "data-disabled:cursor-not-allowed data-disabled:text-faint"
                )}
              >
                <SelectPrimitive.ItemText className="min-w-0 break-keep">{item.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="text-(--link)">
                  <TickCircle size={16} aria-hidden />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export default SelectFull
export { SelectFull }
export type { SelectProps, Option as SelectOption }
