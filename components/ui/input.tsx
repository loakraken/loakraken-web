import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Text and number fields for the tools and search. Pair every field with a
// <label htmlFor>; on error set aria-invalid and point aria-describedby at the
// message. Font size steps up to 16px under 700px so iOS does not zoom.
const fieldClassName = cn(
  "w-full min-w-0 rounded-(--radius-sm) border border-input bg-background text-foreground",
  "text-(length:--text-field) placeholder:text-muted-foreground",
  "transition-[border-color,box-shadow] duration-(--duration-fast) ease-(--ease-out)",
  "focus-visible:border-ring focus-visible:shadow-(--ring-halo) focus-visible:outline-none",
  "aria-invalid:border-destructive",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
)

const inputVariants = cva(fieldClassName, {
  variants: {
    size: {
      md: "h-9 px-3",
      lg: "h-11 px-4",
    },
    numeric: {
      // Amounts and levels: right-aligned tabular figures, as on the targets.
      true: "text-right tabular-nums",
      false: "",
    },
  },
  defaultVariants: {
    size: "md",
    numeric: false,
  },
})

type InputProps = Omit<React.ComponentProps<"input">, "size"> &
  VariantProps<typeof inputVariants>

function Input({ className, size, numeric, inputMode, ...props }: InputProps) {
  return (
    <InputPrimitive
      data-slot="input"
      inputMode={inputMode ?? (numeric ? "decimal" : undefined)}
      className={cn(inputVariants({ size, numeric }), className)}
      {...props}
    />
  )
}

export { Input, inputVariants, fieldClassName }
export type { InputProps }
