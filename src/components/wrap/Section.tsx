import * as React from "react"
import { cn } from "cn"

/** Page-width container: max 1180px with 24px gutters. */
function Wrap({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("wrap", className)} {...props} />
}

/** A section: 64px rhythm, closed by a full-bleed hairline. */
function Section({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <section className={cn("sec", className)} {...props}>
      <Wrap>{children}</Wrap>
    </section>
  )
}

/** Blue lowercase `# eyebrow`. */
function Eyebrow({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("t-eyebrow", className)} {...props}>
      # {children}
    </div>
  )
}

/** 34px section headline, -2px tracked, sentence case. */
function Headline({ className, as: Tag = "h2", ...props }: React.ComponentProps<"h2"> & { as?: "h1" | "h2" | "h3" }) {
  return <Tag className={cn(Tag === "h1" ? "t-display" : "t-h2", "mt-2 text-ink", className)} {...props} />
}

/** One-line grey lede under a headline. */
function Lede({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("t-lede mt-3 max-w-[62ch]", className)} {...props} />
}

/** Section header stack: eyebrow, headline, lede. Figures go 36px below. */
function SectionHeader({
  eyebrow,
  title,
  lede,
  as,
  className,
}: {
  eyebrow: React.ReactNode
  title: React.ReactNode
  lede?: React.ReactNode
  as?: "h1" | "h2" | "h3"
  className?: string
}) {
  return (
    <div className={cn("mb-9", className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Headline as={as}>{title}</Headline>
      {lede ? <Lede>{lede}</Lede> : null}
    </div>
  )
}

export { Wrap, Section, Eyebrow, Headline, Lede, SectionHeader }
