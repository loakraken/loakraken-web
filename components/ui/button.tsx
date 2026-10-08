import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Pill buttons shared by the tools, market and search screens. Press responds
// on pointer-down (scale), hover only on precise pointers, and the focus ring
// comes from the global :focus-visible rule.
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none",
    "transition-[background-color,border-color,color,transform] duration-(--duration-fast) ease-(--ease-out)",
    "not-disabled:active:scale-(--press-scale)",
    "disabled:cursor-not-allowed disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground pointer-fine:not-disabled:hover:bg-primary-hover",
        secondary:
          "bg-foreground text-background pointer-fine:not-disabled:hover:bg-secondary-foreground",
        outline:
          "border border-faint text-foreground pointer-fine:not-disabled:hover:bg-muted",
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

type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
