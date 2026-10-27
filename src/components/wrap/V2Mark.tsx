import { cn } from "cn"

/**
 * The ENSv2 mark: an italic serif "V2" in ENS blue, drawn as text so it scales with the line.
 * Shown beside a name that lives on ENSv2.
 */
function V2Mark({ className, size = 14, title = "on ENSv2" }: { className?: string; size?: number; title?: string }) {
  return (
    <svg
      viewBox="0 0 44 32"
      height={size}
      width={size * 1.375}
      role="img"
      aria-label={title}
      className={cn("inline-block shrink-0 align-[-0.12em]", className)}
    >
      <title>{title}</title>
      <text
        x="0"
        y="27"
        fill="#3B7FC4"
        fontFamily="Georgia, 'Times New Roman', Times, serif"
        fontStyle="italic"
        fontWeight="700"
        fontSize="34"
        letterSpacing="-1.5"
      >
        V2
      </text>
    </svg>
  )
}

export { V2Mark }
