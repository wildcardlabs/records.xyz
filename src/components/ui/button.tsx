import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/**
 * Wrap buttons: 600 12px mono, lowercase, square. Hover recolours, never moves.
 *  primary  ink fill        -> blue
 *  outline  white + hairline -> blue border and text
 *  accent   yellow          -> lilac   (max two per page)
 *  blue     blue fill       -> yellow
 *  white    white on blue   -> yellow  (for use inside the blue band / subnav)
 *  ghost    transparent     -> wash
 *  link     ink text        -> blue
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-none border bg-clip-padding font-mono text-[12px] font-semibold lowercase leading-[1.65] whitespace-nowrap select-none outline-none transition-[background-color,border-color,color] duration-150 ease-[ease] focus-visible:border-blue focus-visible:ring-2 focus-visible:ring-blue/30 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-err [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        primary: "border-ink bg-ink text-paper hover:border-blue hover:bg-blue hover:text-blue-fg",
        outline: "border-line bg-paper text-ink hover:border-blue hover:text-blue aria-expanded:border-blue aria-expanded:text-blue",
        accent: "border-yellow bg-yellow text-yellow-fg hover:border-lilac hover:bg-lilac",
        blue: "border-blue bg-blue text-blue-fg hover:border-yellow hover:bg-yellow hover:text-yellow-fg",
        white: "border-paper bg-paper text-blue hover:border-yellow hover:bg-yellow hover:text-yellow-fg",
        ghost: "border-transparent bg-transparent text-ink hover:bg-wash aria-expanded:bg-wash",
        destructive: "border-line bg-paper text-err hover:border-err",
        link: "border-transparent bg-transparent px-0 text-ink underline-offset-4 hover:text-blue",
      },
      size: {
        default: "px-3.5 py-[9px]",
        sm: "px-2.5 py-1.5 text-[11px]",
        lg: "px-5 py-[11px] tracking-[.02em]",
        icon: "size-8",
        "icon-sm": "size-7",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
