import { useMemo } from "react"
import { cn } from "cn"

/**
 * Hero cell grid: a cols×rows field of 18px outlined squares with `lit` of them filled blue-2.
 * Lit cells are chosen deterministically from `seed` so the figure is stable between renders.
 */
function CellGrid({
  cols = 16,
  rows = 7,
  lit = 6,
  seed = 7,
  pulse = true,
  className,
}: {
  cols?: number
  rows?: number
  lit?: number
  seed?: number
  pulse?: boolean
  className?: string
}) {
  const litSet = useMemo(() => {
    const total = cols * rows
    const picks = new Set<number>()
    let x = seed
    while (picks.size < Math.min(lit, total)) {
      x = (x * 1103515245 + 12345) % 2147483648
      picks.add(x % total)
    }
    return picks
  }, [cols, rows, lit, seed])

  return (
    <div
      className={cn("grid w-fit gap-[3px]", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, 18px)` }}
      aria-hidden="true"
    >
      {Array.from({ length: cols * rows }, (_, i) => (
        <span key={i} className={cn("cell", pulse && "cell-pulse")} data-lit={litSet.has(i) ? "true" : "false"} />
      ))}
    </div>
  )
}

export { CellGrid }
