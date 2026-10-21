import * as React from "react"
import { cn } from "cn"

type Token = { t: "k" | "s" | "c" | "n" | "p"; v: string }
type Line = Token[]

/**
 * Figure code block. Tokens: k = key (blue), s = string (olive), c = comment (dim), n = number (blue-2), p = plain.
 */
function Code({ lines, className }: { lines: Line[]; className?: string }) {
  return (
    <pre className={cn("code", className)}>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {line.map((tok, j) => (tok.t === "p" ? tok.v : <span key={j} className={tok.t}>{tok.v}</span>))}
          {i < lines.length - 1 ? "\n" : null}
        </React.Fragment>
      ))}
    </pre>
  )
}

/** Tiny helpers so call sites read like the snippet. */
const k = (v: string): Token => ({ t: "k", v })
const s = (v: string): Token => ({ t: "s", v })
const c = (v: string): Token => ({ t: "c", v })
const n = (v: string): Token => ({ t: "n", v })
const p = (v: string): Token => ({ t: "p", v })

export { Code, k, s, c, n, p }
export type { Line, Token }
