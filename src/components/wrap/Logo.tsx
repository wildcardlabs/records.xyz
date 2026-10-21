import { cn } from "cn"

/** Pixel-stepped square (corners notched 1px at a time) with a slanted parallelogram inside. */
function Logo({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      shapeRendering="crispEdges"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <path fill="currentColor" d="M3 1h26v1h1v1h1v26h-1v1h-1v1H3v-1H2v-1H1V3h1V2h1z" />
      <path fill="var(--bg)" d="M12 8h12l-4 16H8z" />
      <path fill="var(--blue)" d="M14 11h7l-2.5 10H11z" />
    </svg>
  )
}

export { Logo }
