import { cn } from "cn"

/**
 * The records.xyz mark: four cells on a 2×2 grid — a triangle, a half-disc tab,
 * and two quarter-discs. Three cells take the current text colour; the tab is the
 * electric blue. `mono` renders every cell in currentColor (for the blue band).
 */
function Logo({ className, size = 20, mono = false }: { className?: string; size?: number; mono?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden="true">
      <path fill="currentColor" d="M0 0H16L0 16Z" />
      <path fill={mono ? "currentColor" : "var(--blue)"} d="M16 0H24A8 8 0 0 1 24 16H16Z" />
      <path fill="currentColor" d="M0 16V32A16 16 0 0 0 16 16Z" />
      <path fill="currentColor" d="M16 32H32A16 16 0 0 0 16 16Z" />
    </svg>
  )
}

export { Logo }
