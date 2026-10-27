import { cn } from "cn"

/** "V2" in the ENSv2 mark's italic serif, ENS blue, inline with whatever text it sits beside. */
function V2({ className, title = "on ENSv2" }: { className?: string; title?: string }) {
  return (
    <span className={cn("v2-mark", className)} title={title} aria-label={title}>
      V2
    </span>
  )
}

export { V2 }
