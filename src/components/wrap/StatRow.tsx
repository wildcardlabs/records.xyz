import * as React from "react"
import { cn } from "cn"

type Stat = { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode }

/** Four-cell stat row: hairline cells, dim uppercase label, 22px value. */
function StatRow({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-px bg-line sm:grid-cols-4", className)}>
      {stats.map((s, i) => (
        <div key={i} className="bg-paper px-4 py-3">
          <div className="t-label text-ink-dim">{s.label}</div>
          <div className="t-h4 mt-1 tabular text-ink">{s.value}</div>
          {s.hint ? <div className="t-caption mt-0.5 normal-case tracking-normal">{s.hint}</div> : null}
        </div>
      ))}
    </div>
  )
}

export { StatRow }
export type { Stat }
