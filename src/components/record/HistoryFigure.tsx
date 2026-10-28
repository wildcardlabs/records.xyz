import { useEffect, useMemo, useState } from "react"
import { AddressLink, HcaPill, Pager, StatusText, usePager } from "@/components/wrap"
import { useHcaOwners } from "@/hooks/useHcaOwners"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Link } from "react-router-dom"
import { useHistory } from "@/hooks/useNameHistory"
import type { HistoryRow } from "@/lib/ens/history"
import { shortAddr } from "@/lib/format"

const TABS: { id: HistoryRow["group"] | "all"; label: string; hint: string }[] = [
  { id: "all", label: "everything", hint: "every change, newest first" },
  { id: "records", label: "profile", hint: "text records, payment addresses and the content hash" },
  { id: "accounts", label: "wallets on the record", hint: "consents signed, renewed or removed" },
  { id: "links", label: "shared profile", hint: "which profile this name uses" },
  { id: "access", label: "access", hint: "who was allowed to edit what" },
  { id: "name", label: "ownership", hint: "registration, expiry, owner and resolver" },
]

const AUTO_LOAD_ROWS = 500

const when = (at: number) => {
  const d = new Date(at * 1000)
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`
}

/** Every change to a name, or to everything a wallet owns, newest first: one tab per kind, fifteen rows a page. */
function HistoryFigure({ name, address, recordsChainId, explorer, enabled }: { name?: string; address?: string; recordsChainId: number; explorer: string; enabled: boolean }) {
  const q = useHistory({ name, address }, recordsChainId, enabled)
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all")
  const rows = useMemo(() => q.data?.pages.flatMap((p) => p?.rows ?? []) ?? [], [q.data])
  // the first page shows at once; the rest streams in behind it up to a few hundred rows, then on request
  const autoLoad = rows.length < AUTO_LOAD_ROWS
  useEffect(() => {
    if (autoLoad && q.hasNextPage && !q.isFetchingNextPage && !q.isError) q.fetchNextPage()
  }, [autoLoad, q.hasNextPage, q.isFetchingNextPage, q.isError, q.fetchNextPage, rows.length])
  const shown = useMemo(() => rows.filter((r) => tab === "all" || r.group === tab), [rows, tab])
  const pager = usePager(shown, 15)
  const hca = useHcaOwners(pager.slice.map((r) => r.address))
  const current = TABS.find((t) => t.id === tab)!

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-5">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); pager.setPage(0) }}
              className={`t-label -mb-px border-b pb-1 transition-colors ${tab === t.id ? "border-blue text-blue" : "border-transparent text-ink-dim hover:text-ink"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="t-caption normal-case tracking-normal">{q.isFetchingNextPage ? "loading more…" : current.hint}</span>
      </div>
      {q.isLoading ? (
        <div className="space-y-2 p-4"><div className="h-3 w-56 bg-wash" /><div className="h-3 w-40 bg-wash" /><div className="h-3 w-48 bg-wash" /></div>
      ) : q.isError ? (
        <div className="p-4 text-[12px]"><StatusText tone="err">could not load history.</StatusText> <button type="button" className="link-blue text-ink" onClick={() => q.refetch()}>try again</button></div>
      ) : shown.length === 0 ? (
        <p className="t-fig-body p-4 text-ink-dim sm:p-5">{rows.length === 0 ? "nothing recorded yet." : "nothing here yet."}</p>
      ) : (
        <Table stack>
          <TableHeader>
            <TableRow>
              <TableHead>when</TableHead>
              {address ? <TableHead>name</TableHead> : null}
              <TableHead>what</TableHead>
              <TableHead>change</TableHead>
              <TableHead className="text-right">tx</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pager.slice.map((r) => (
              <TableRow key={r.id}>
                <TableCell data-label="when" className="tabular text-ink-dim">{when(r.at)}</TableCell>
                {address ? (
                  <TableCell data-label="name">
                    {r.name ? <Link className="link-blue font-semibold text-ink" to={`/${r.name}`}>{r.name}</Link> : r.resolver ? <span className="text-ink-dim">{r.recordId ? `record ${r.recordId} · ` : ""}{shortAddr(r.resolver, 4)}</span> : <span className="text-ink-dim">—</span>}
                  </TableCell>
                ) : null}
                <TableCell data-label="what">
                  <span className="inline-flex items-center gap-2">
                    <span className="font-semibold text-ink">{r.label}</span>
                    {r.address ? <AddressLink address={r.address} chars={4} /> : null}
                    {r.address && hca.data?.[r.address.toLowerCase()] ? <HcaPill owner={hca.data[r.address.toLowerCase()]} /> : null}
                  </span>
                </TableCell>
                <TableCell data-label="change" className="whitespace-normal">
                  {r.full && r.full !== r.detail ? (
                    <Tooltip>
                      <TooltipTrigger render={<span className="cursor-help" />}>{r.detail}</TooltipTrigger>
                      <TooltipContent className="max-w-sm font-mono text-[11px] break-all whitespace-normal">{r.full}</TooltipContent>
                    </Tooltip>
                  ) : (
                    r.detail
                  )}
                </TableCell>
                <TableCell data-label="tx" className="text-right">
                  <a className="link-blue text-ink-dim" href={`${explorer}/tx/${r.tx}`} target="_blank" rel="noreferrer">{shortAddr(r.tx, 4)}</a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pager page={pager.page} pages={pager.pages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
      {!autoLoad && q.hasNextPage ? (
        <div className="border-t border-line px-4 py-2 text-right text-[11px] sm:px-5">
          <button type="button" className="link-blue text-ink" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>{q.isFetchingNextPage ? "loading…" : "load older changes"}</button>
        </div>
      ) : null}
    </div>
  )
}

export { HistoryFigure }
