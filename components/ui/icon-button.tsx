import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Icon-only button. The accessible name is required because there is no
// visible text; the icon itself should carry aria-hidden. A pressed state
// (aria-pressed, e.g. favourite) turns the icon warm.
const iconButtonVariants = cva(
  [
    "inline-grid shrink-0 place-items-center rounded-full text-foreground",
    "transition-[background-color,color,transform] duration-(--duration-fast) ease-(--ease-out)",
    "not-disabled:active:scale-(--press-scale)",
    "pointer-fine:not-disabled:hover:bg-hover-surface",
    "aria-pressed:text-accent-warm",
    "disabled:cursor-not-allowed disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      size: {
        md: "size-11 [&_svg]:size-5",
        sm: "size-8 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

type IconButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof iconButtonVariants> & { "aria-label": string }

function IconButton({ className, size, ...props }: IconButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="icon-button"
      className={cn(iconButtonVariants({ size }), className)}
      {...props}
    />
  )
}

export { IconButton, iconButtonVariants }
export type { IconButtonProps }
