import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"

export const PAGE_SIZE = 25

/** Client-side paging over a list already in memory. The page resets whenever the list changes shape. */
export function usePager<T>(items: T[], size = PAGE_SIZE) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(items.length / size))
  useEffect(() => {
    setPage(0)
  }, [items.length])
  const current = Math.min(page, pages - 1)
  const slice = useMemo(() => items.slice(current * size, current * size + size), [items, current, size])
  return { page: current, pages, slice, total: items.length, from: items.length === 0 ? 0 : current * size + 1, to: Math.min(items.length, (current + 1) * size), setPage }
}

/** previous · n–m of N · next, in the figure's own type scale. Renders nothing for a single page. */
function Pager({ page, pages, from, to, total, onPage }: { page: number; pages: number; from: number; to: number; total: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-end gap-3 border-t border-line px-4 py-2 text-[11px] sm:px-5">
      <span className="text-ink-dim">{from}–{to} of {total}</span>
      <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => onPage(page - 1)}>← previous</Button>
      <Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>next →</Button>
    </div>
  )
}

export { Pager }
