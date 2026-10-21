import { useState } from "react"
import { cn } from "cn"

/** Full-width question row: blue `>` prompt, lowercase question, `[+]` / `[−]` on the right. */
function FaqRow({ q, children, defaultOpen = false }: { q: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn("hover-wash flex w-full items-center gap-3 px-2 py-4 text-left font-mono text-[13px] font-medium lowercase text-ink")}
      >
        <span className="text-blue">&gt;</span>
        <span className="flex-1">{q}</span>
        <span className="text-ink-dim">[{open ? "−" : "+"}]</span>
      </button>
      {open ? <div className="t-body px-2 pb-5 pl-8">{children}</div> : null}
    </div>
  )
}

export { FaqRow }
