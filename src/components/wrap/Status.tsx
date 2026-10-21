import * as React from "react"
import { cn } from "cn"
import { Badge } from "@/components/ui/badge"

type Tone = "ok" | "wait" | "err" | "dim" | "blue"

const toneText: Record<Tone, string> = {
  ok: "text-ok",
  wait: "text-wait",
  err: "text-err",
  dim: "text-ink-dim",
  blue: "text-blue",
}

/** `● LIVE` pill: the dot blinks on a 2s step. */
function LivePill({ children = "live", tone = "ok", pulse = true, className }: { children?: React.ReactNode; tone?: Tone; pulse?: boolean; className?: string }) {
  return (
    <Badge variant="pill" className={cn(toneText[tone], className)}>
      <span className={cn("dot", pulse && "dot-live")} />
      {children}
    </Badge>
  )
}

/** Inline pass/fail text: olive, ochre, brick. Lowercase. */
function StatusText({ tone, children, className, ...props }: React.ComponentProps<"span"> & { tone: Tone }) {
  return (
    <span className={cn("lowercase", toneText[tone], className)} {...props}>
      {children}
    </span>
  )
}

/** Lilac bracketed key, as in the subnav: `[L] line`. */
function KeyChip({ k, children, className }: { k: string; children?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-mono text-[12px] font-medium lowercase", className)}>
      <span className="text-lilac">[{k}]</span>
      {children}
    </span>
  )
}

export { LivePill, StatusText, KeyChip }
export type { Tone }
