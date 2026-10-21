import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/**
 * Wrap badges.
 *  outline  square-cornered outlined rectangle, uppercase tracked (PASS / BEST)
 *  pill     20px pill for status chips (LIVE, run badges, layer tags)
 *  ok/wait/err  status colours: olive, ochre, brick. Never neon.
 *  blue     blue outline + blue text (ink, not paint)
 *  solid    ink fill
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border font-mono text-[10px] font-normal uppercase tracking-[.14em] leading-none transition-colors duration-150 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        outline: "rounded-none border-line bg-paper px-1.5 py-[3px] text-ink",
        pill: "rounded-[20px] border-line bg-paper px-2 py-[3px] text-ink",
        ok: "rounded-[20px] border-line bg-paper px-2 py-[3px] text-ok",
        wait: "rounded-[20px] border-line bg-paper px-2 py-[3px] text-wait",
        err: "rounded-[20px] border-line bg-paper px-2 py-[3px] text-err",
        blue: "rounded-none border-blue bg-paper px-1.5 py-[3px] text-blue",
        solid: "rounded-none border-ink bg-ink px-1.5 py-[3px] text-paper",
        dim: "rounded-none border-line bg-paper px-1.5 py-[3px] text-ink-dim",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  }
)

function Badge({
  className,
  variant = "outline",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      { className: cn(badgeVariants({ variant }), className) },
      props
    ),
    render,
    state: { slot: "badge", variant },
  })
}

export { Badge, badgeVariants }
