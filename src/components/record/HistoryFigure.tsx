import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronDown, ChevronRight } from "lucide-react"
import { AddressLink, HcaPill, Pager, StatusText, usePager } from "@/components/wrap"
import { useHcaOwners } from "@/hooks/useHcaOwners"
import { useHistory } from "@/hooks/useNameHistory"
import { useRecordNames } from "@/hooks/useRecordNames"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { keccak256, toBytes } from "viem"
import { type HistoryAction, buildActions, isReverseName } from "@/lib/ens/actions"
import type { HistoryRow } from "@/lib/ens/history"
import { shortAddr } from "@/lib/format"

const TABS: { id: HistoryRow["group"] | "all"; label: string; hint: string }[] = [
  { id: "all", label: "everything", hint: "every change, newest first" },
  { id: "records", label: "profile", hint: "text records, payment addresses and the content hash" },
  { id: "accounts", label: "wallets on the record", hint: "wallets added, renewed or removed" },
  { id: "links", label: "shared profile", hint: "which profile a name uses" },
  { id: "access", label: "access", hint: "who was allowed to edit what" },
  { id: "name", label: "ownership", hint: "registration, expiry, owner and resolver" },
]

const AUTO_LOAD_ROWS = 500

const when = (at: number) => {
  const d = new Date(at * 1000)
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`
}

/**
 * What happened to a name, or to everything a wallet owns, newest first: one line per action
 * in plain words, the indexer's events a click away. The first page shows at once, the rest
 * streams in behind it.
 */
function HistoryFigure({ name, address, recordsChainId, explorer, enabled }: { name?: string; address?: string; recordsChainId: number; explorer: string; enabled: boolean }) {
  const q = useHistory({ name, address }, recordsChainId, enabled)
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all")
  const [open, setOpen] = useState<string | null>(null)
  const rows = useMemo(() => q.data?.pages.flatMap((p) => p?.rows ?? []) ?? [], [q.data])
  const autoLoad = rows.length < AUTO_LOAD_ROWS
  useEffect(() => {
    if (autoLoad && q.hasNextPage && !q.isFetchingNextPage && !q.isError) q.fetchNextPage()
  }, [autoLoad, q.hasNextPage, q.isFetchingNextPage, q.isError, q.fetchNextPage, rows.length])

  const recordNames = useRecordNames(recordsChainId, rows.map((r) => r.resolver))
  const actions = useMemo(() => buildActions(rows, recordNames.namesForRecord), [rows, recordNames.namesForRecord])
  const shown = useMemo(() => actions.filter((a) => tab === "all" || a.groups.includes(tab)), [actions, tab])
  const pager = usePager(shown, 15, tab)
  const hca = useHcaOwners(pager.slice.map((a) => a.address))
  const current = TABS.find((t) => t.id === tab)!
  const ownHash = address ? { hash: keccak256(toBytes(address.slice(2).toLowerCase())), address } : null

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
        <p className="t-fig-body p-4 text-ink-dim sm:p-5">{actions.length === 0 ? "nothing recorded yet." : "nothing here yet."}</p>
      ) : (
        <Table stack>
          <TableHeader>
            <TableRow>
              <TableHead>when</TableHead>
              {address ? <TableHead>name</TableHead> : null}
              <TableHead>what happened</TableHead>
              <TableHead className="text-right">tx</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pager.slice.map((a) => (
              <ActionRows key={a.id} action={a} withName={!!address} explorer={explorer} open={open === a.id} onToggle={() => setOpen(open === a.id ? null : a.id)} hcaOwner={a.address ? hca.data?.[a.address.toLowerCase()] : undefined} ownHash={ownHash} />
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

/** the sentence, with the wallet it names turned into a link to that wallet's page */
function ActionText({ text, address }: { text: string; address?: string }) {
  if (!address) return <>{text}</>
  const short = shortAddr(address, 4)
  const parts = text.split(short)
  if (parts.length === 1) return <>{text} <AddressLink address={address} chars={4} /></>
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 ? <AddressLink address={address} chars={4} /> : null}
        </span>
      ))}
    </>
  )
}

/** one action, and its events underneath when opened */
/** "[9fd4…].addr.reverse" is the wallet's own reverse node when its label is the hash of the wallet address */
function reverseLabel(n: string, own: { hash: string; address: string } | null): string {
  const m = n.match(/^\[([0-9a-f]{64})\]\.addr\.reverse$/)
  if (m && own && `0x${m[1]}` === own.hash) return shortAddr(own.address, 4)
  return "another address"
}

function ActionRows({ action: a, withName, explorer, open, onToggle, hcaOwner, ownHash }: { action: HistoryAction; withName: boolean; explorer: string; open: boolean; onToggle: () => void; hcaOwner?: `0x${string}`; ownHash: { hash: string; address: string } | null }) {
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell data-label="when" className="tabular text-ink-dim">{when(a.at)}</TableCell>
        {withName ? (
          <TableCell data-label="name">
            {a.names.length ? (
              a.names.map((n, i) => (
                <span key={n}>
                  {i ? ", " : ""}
                  {isReverseName(n) ? <span className="text-ink-dim">{reverseLabel(n, ownHash)}</span> : <Link className="link-blue font-semibold text-ink" to={`/${n}`} onClick={(e) => e.stopPropagation()}>{n}</Link>}
                </span>
              ))
            ) : a.resolver ? (
              <span className="text-ink-dim">{a.recordId ? `record ${a.recordId} · ` : ""}{shortAddr(a.resolver, 4)}</span>
            ) : (
              <span className="text-ink-dim">—</span>
            )}
          </TableCell>
        ) : null}
        <TableCell data-label="what happened" className="whitespace-normal">
          <span className="flex items-start gap-2">
            <Chevron className="mt-[3px] size-3.5 shrink-0 text-ink-dim" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-ink">
              <ActionText text={a.text} address={a.address} />
              {hcaOwner ? <> <HcaPill owner={hcaOwner} /></> : null}
            </span>
          </span>
        </TableCell>
        <TableCell data-label="tx" className="text-right">
          <a className="link-blue text-ink-dim" href={`${explorer}/tx/${a.tx}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{shortAddr(a.tx, 4)}</a>
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow className="bg-wash/40">
          <TableCell colSpan={withName ? 4 : 3} className="whitespace-normal py-2">
            <ul className="divide-y divide-line-soft text-[11.5px]">
              {a.events.map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1">
                  <span className="min-w-[10rem] text-ink-muted">{r.label}</span>
                  {r.full && r.full !== r.detail ? (
                    <Tooltip>
                      <TooltipTrigger render={<span className="cursor-help text-ink-dim" />}>{r.detail}</TooltipTrigger>
                      <TooltipContent className="max-w-sm font-mono text-[11px] break-all whitespace-normal">{r.full}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-ink-dim">{r.detail}</span>
                  )}
                  {r.address ? <AddressLink address={r.address} chars={4} /> : null}
                </li>
              ))}
            </ul>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

export { HistoryFigure }
