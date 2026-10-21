import * as React from "react"
import { cn } from "cn"

type Layer = { label: string; title: string; tags?: string[]; copy?: React.ReactNode }

/**
 * Layer stack: horizontal bars, each wider than the one above, filled with blue at 5 / 14 / 30 / 100%.
 * `--stack-step` (0–12) controls how much narrower each bar is than the next.
 */
function LayerStack({ layers, className }: { layers: Layer[]; className?: string }) {
  const fills = [5, 14, 30, 100]
  const n = layers.length
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {layers.map((l, i) => {
        const fill = fills[Math.min(i, fills.length - 1)]
        const last = i === n - 1
        const width = `calc(100% - ${(n - 1 - i) * 2}% * var(--stack-step) / 2)`
        return (
          <div
            key={i}
            className={cn("flex items-center gap-3 px-3 py-2", last ? "text-blue-fg" : "text-night")}
            style={{
              width,
              background: `color-mix(in srgb, var(--blue) ${fill}%, var(--bg-2))`,
            }}
          >
            <span className="t-label shrink-0 opacity-80">{l.label}</span>
            <span className="font-sans text-[12.5px] font-medium">{l.title}</span>
            {l.tags?.map((t) => (
              <span
                key={t}
                className={cn("rounded-[20px] border px-2 py-px text-[9.5px] uppercase tracking-[.1em]", last ? "border-blue-fg/40" : "border-night/20")}
              >
                {t}
              </span>
            ))}
            {l.copy ? <span className="ml-auto hidden font-mono text-[11px] sm:inline">{l.copy}</span> : null}
          </div>
        )
      })}
    </div>
  )
}

export { LayerStack }
export type { Layer }
