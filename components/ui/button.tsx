import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Pill buttons shared by the tools, market and search screens. Press responds
// on pointer-down (scale), hover only on precise pointers, and the focus ring
// comes from the global :focus-visible rule. Base UI marks disabled buttons
// with data-disabled, including loading ones that stay focusable.
const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none",
    "transition-[background-color,border-color,color,transform,scale] duration-(--duration-fast) ease-(--ease-out)",
    "not-data-disabled:active:scale-(--press-scale)",
    "[&[data-disabled]:not([aria-busy=true])]:cursor-not-allowed [&[data-disabled]:not([aria-busy=true])]:opacity-40",
    "aria-busy:cursor-progress",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground pointer-fine:not-data-disabled:hover:bg-primary-hover",
        secondary:
          "bg-foreground text-background pointer-fine:not-data-disabled:hover:bg-secondary-foreground",
        outline:
          "border border-faint text-foreground pointer-fine:not-data-disabled:hover:bg-hover-surface",
      },
      size: {
        md: "h-11 px-[22px] text-(length:--text-body) [&_svg]:size-[18px]",
        sm: "h-8 px-3.5 text-(length:--text-caption) [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Busy state: keeps focus, width and the accessible name (label faded out under a spinner). */
    loading?: boolean
  }

function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  focusableWhenDisabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      focusableWhenDisabled={loading || focusableWhenDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="inline-flex items-center gap-2 opacity-0">
            {children}
          </span>
          <span
            aria-hidden="true"
            className="absolute size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
          />
        </>
      ) : (
        children
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
