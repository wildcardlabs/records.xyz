import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { StatusText } from "@/components/wrap"
import { useNameHistory } from "@/hooks/useNameHistory"
import type { HistoryRow } from "@/lib/ens/history"
import { shortAddr } from "@/lib/format"

const GROUPS: { id: HistoryRow["group"] | "all"; label: string }[] = [
  { id: "all", label: "everything" },
  { id: "records", label: "records" },
  { id: "accounts", label: "owned accounts" },
  { id: "links", label: "shared records" },
  { id: "access", label: "access" },
  { id: "name", label: "the name" },
]

const when = (at: number) => {
  const d = new Date(at * 1000)
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`
}

/** Every change to a name, newest first, from the indexer. Loads a page at a time. */
function HistoryFigure({ name, recordsChainId, explorer, enabled }: { name: string; recordsChainId: number; explorer: string; enabled: boolean }) {
  const q = useNameHistory(name, recordsChainId, enabled)
  const [group, setGroup] = useState<(typeof GROUPS)[number]["id"]>("all")
  const rows = useMemo(() => (q.data?.pages ?? []).flatMap((p) => p?.rows ?? []), [q.data])
  const shown = rows.filter((r) => group === "all" || r.group === group)
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.group, (m.get(r.group) ?? 0) + 1)
    return m
  }, [rows])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-5">
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {GROUPS.map((g) => {
            const n = g.id === "all" ? rows.length : (counts.get(g.id) ?? 0)
            if (g.id !== "all" && n === 0 && !q.hasNextPage) return null
            return (
              <button key={g.id} type="button" onClick={() => setGroup(g.id)} className={`border px-2 py-0.5 ${group === g.id ? "border-blue text-blue" : "border-line text-ink-muted hover:border-blue hover:text-blue"}`}>
                {g.label}{n ? ` ${n}` : ""}
              </button>
            )
          })}
        </div>
        <span className="t-caption normal-case tracking-normal">from <a className="link-blue" href="https://bigname.sh" target="_blank" rel="noreferrer">bigname</a> · newest first</span>
      </div>
      {q.isLoading ? (
        <div className="space-y-2 p-4"><div className="h-3 w-56 bg-wash" /><div className="h-3 w-40 bg-wash" /><div className="h-3 w-48 bg-wash" /></div>
      ) : q.isError ? (
        <div className="p-4 text-[12px]"><StatusText tone="err">could not load history.</StatusText> <button type="button" className="link-blue text-ink" onClick={() => q.refetch()}>try again</button></div>
      ) : shown.length === 0 ? (
        <p className="t-fig-body p-4 text-ink-dim sm:p-5">{rows.length === 0 ? "nothing recorded yet." : "nothing of that kind in the pages loaded so far."}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>when</TableHead>
              <TableHead>what</TableHead>
              <TableHead>change</TableHead>
              <TableHead className="text-right">tx</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="tabular text-ink-dim">{when(r.at)}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <span className="font-semibold text-ink">{r.label}</span>
                    {group === "all" ? <Badge variant="dim">{GROUPS.find((g) => g.id === r.group)?.label}</Badge> : null}
                  </span>
                </TableCell>
                <TableCell className="whitespace-normal">
                  {r.full && r.full !== r.detail ? (
                    <Tooltip>
                      <TooltipTrigger render={<span className="cursor-help" />}>{r.detail}</TooltipTrigger>
                      <TooltipContent className="max-w-sm font-mono text-[11px] break-all whitespace-normal">{r.full}</TooltipContent>
                    </Tooltip>
                  ) : (
                    r.detail
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <a className="link-blue text-ink-dim" href={`${explorer}/tx/${r.tx}`} target="_blank" rel="noreferrer">{shortAddr(r.tx, 4)}</a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {q.hasNextPage ? (
        <div className="flex items-center justify-end border-t border-line px-4 py-2 sm:px-5">
          <Button size="sm" variant="ghost" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>{q.isFetchingNextPage ? "loading…" : "load older"}</Button>
        </div>
      ) : null}
    </div>
  )
}

export { HistoryFigure }
