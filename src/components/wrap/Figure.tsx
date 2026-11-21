import * as React from "react"
import { cn } from "cn"

type FigureProps = React.ComponentProps<"figure"> & {
  /** short name shown in the bar, e.g. "quickstart" or "taste loop · sample shift" */
  name: string
  /** draw the dotted lavender panel behind the body */
  dotted?: boolean
  /** padding inside the body; set false when the body is a table or code block */
  padded?: boolean
}

/**
 * The signature figure: hairline frame, a `>_ ——— [ name ] ——— ⌗` bar,
 * and a pale lavender dotted panel. Every product visual is drawn inside one of these.
 */
function Figure({ name, dotted = true, padded = true, className, children, ...props }: FigureProps) {
  return (
    <figure data-slot="figure" className={cn("fig m-0 flex min-w-0 flex-col", className)} {...props}>
      <FigBar name={name} />
      <div className={cn("min-w-0 flex-1", dotted && "fig-body", padded && "p-4 sm:p-5")}>{children}</div>
    </figure>
  )
}

function FigBar({ name, className }: { name: string; className?: string }) {
  return (
    <div className={cn("fig-bar", className)} aria-hidden="true">
      <span className="ic">&gt;_</span>
      <span className="rule" />
      <span className="truncate">[ {name} ]</span>
      <span className="rule" />
      <span className="ic">⌗</span>
    </div>
  )
}

/** A hairline-divided split inside a figure body (e.g. list left, chart right). */
function FigSplit({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("grid divide-line max-sm:divide-y sm:grid-cols-2 sm:divide-x [&>*]:min-w-0", className)} {...props}>
      {children}
    </div>
  )
}

export { Figure, FigBar, FigSplit }
