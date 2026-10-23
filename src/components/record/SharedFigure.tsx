import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LivePill, PAGE_SIZE, Pager, usePager } from "@/components/wrap"
import { type LinkChange, ROOT_NAME, type ResolverLink } from "@/lib/ens/links"

/** What a name actually reads: its own record, else the default record, else nothing. */
export function effectiveRecord(row: ResolverLink | undefined, defaultId: string): string {
  if (!row) return defaultId
  return row.recordId !== "0" ? row.recordId : defaultId
}

/**
 * Every name bound to this ENSv2 resolver and the record each one reads. Names on the same
 * record share one profile: edit it under any of them and all of them change. The root name
 * carries the default record, which every name without a record of its own falls back to.
 */
function SharedFigure({
  name,
  recordsChainId,
  rows,
  indexed,
  loading,
  canLink,
  staged,
  onShare,
  onStage,
}: {
  name: string
  recordsChainId: number
  rows: ResolverLink[] | undefined
  indexed: boolean
  loading: boolean
  canLink: boolean
  staged: LinkChange[]
  onShare: () => void
  onStage: (c: LinkChange) => void
}) {
  const list = rows ?? []
  const me = list.find((r) => !r.isDefault && r.name === name)
  const root = list.find((r) => r.isDefault)
  const defaultId = root?.recordId ?? "0"
  const myId = effectiveRecord(me, defaultId)
  const names = list.filter((r) => !r.isDefault)
  const recordCount = new Set(names.map((r) => effectiveRecord(r, defaultId)).filter((id) => id !== "0")).size
  const sharers = (id: string) => names.filter((r) => effectiveRecord(r, defaultId) === id).length
  const stagedFor = (source: string) => staged.find((s) => s.sourceName === source)
  const net = recordsChainId === 11155111 ? "?net=sepolia" : ""

  const [q, setQ] = useState("")
  const sorted = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const rank = (r: ResolverLink) => (r.name === name ? 0 : effectiveRecord(r, defaultId) === myId ? 1 : 2)
    return names.filter((r) => !needle || r.name.includes(needle)).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names, q, name, defaultId, myId])
  const pager = usePager(sorted)
  const many = names.length > PAGE_SIZE

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-5">
        <span className="t-caption normal-case tracking-normal">
          {loading ? "reading records…" : `${names.length} ${names.length === 1 ? "name" : "names"} on this resolver · ${recordCount} ${recordCount === 1 ? "record" : "records"}${indexed ? "" : " · only this name is listed without an indexer"}`}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {many ? <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter names" aria-label="filter names on this resolver" className="h-8 w-44 text-[12px]" /> : null}
          <Button size="sm" variant={canLink ? "accent" : "outline"} disabled={!canLink || loading} onClick={onShare}>+ share with another name</Button>
        </div>
      </div>
      {loading ? (
        <div className="space-y-2 p-4"><div className="h-3 w-56 bg-wash" /><div className="h-3 w-40 bg-wash" /></div>
      ) : (
        <Table stack>
          <TableHeader>
            <TableRow>
              <TableHead>name</TableHead>
              <TableHead>reads</TableHead>
              <TableHead>record</TableHead>
              {canLink ? <TableHead className="text-right"></TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* the default record: what every name without a record of its own reads */}
            <TableRow className={stagedFor(ROOT_NAME) ? "opacity-60" : undefined}>
              <TableCell data-label="name">
                <span className="inline-flex items-center gap-2">
                  <span className="font-semibold text-ink">default record</span>
                  <span className="t-caption normal-case tracking-normal">any name without one</span>
                </span>
              </TableCell>
              <TableCell data-label="reads">{defaultId === "0" ? "nothing set" : `record #${defaultId}`}</TableCell>
              <TableCell data-label="record">{defaultId === "0" ? <span className="text-ink-dim">—</span> : <Badge variant={defaultId === myId ? "blue" : "outline"}>#{defaultId}</Badge>}</TableCell>
              {canLink ? (
                <TableCell className="text-right whitespace-normal">
                  {stagedFor(ROOT_NAME) ? (
                    <span className="text-[11px] text-blue">change staged</span>
                  ) : myId !== "0" && defaultId !== myId ? (
                    <Button size="sm" variant="outline" onClick={() => onStage({ sourceName: ROOT_NAME, recordId: myId, scope: `default record · names without their own use ${name}'s records (#${myId})` })}>
                      use {name}'s records
                    </Button>
                  ) : defaultId !== "0" && defaultId === myId ? (
                    <Button size="sm" variant="ghost" onClick={() => onStage({ sourceName: ROOT_NAME, recordId: "0", scope: "default record · cleared" })}>
                      clear
                    </Button>
                  ) : null}
                </TableCell>
              ) : null}
            </TableRow>
            {pager.slice.map((r) => {
              const eff = effectiveRecord(r, defaultId)
              const isMe = r.name === name
              const shared = eff !== "0" && sharers(eff) > 1
              const pending = stagedFor(r.name)
              const reads = eff === "0" ? "nothing yet · no record of its own" : r.recordId === "0" ? "the default record" : shared ? `a record shared by ${sharers(eff)} names` : "its own record"
              return (
                <TableRow key={r.node} className={pending ? "opacity-60" : undefined}>
                  <TableCell data-label="name">
                    <span className="inline-flex items-center gap-2">
                      {isMe ? <span className="font-semibold text-ink">{r.name}</span> : <Link className="link-blue font-semibold text-ink" to={`/${r.name}${net}`}>{r.name}</Link>}
                      {isMe ? <LivePill pulse={false}>this name</LivePill> : null}
                    </span>
                  </TableCell>
                  <TableCell data-label="reads">{reads}</TableCell>
                  <TableCell data-label="record">
                    {eff === "0" ? <span className="text-ink-dim">—</span> : <Badge variant={eff === myId ? "blue" : "outline"}>#{eff}</Badge>}
                  </TableCell>
                  {canLink ? (
                    <TableCell className="text-right whitespace-normal">
                      {pending ? (
                        <span className="text-[11px] text-blue">change staged</span>
                      ) : isMe ? (
                        r.recordId !== "0" && shared ? (
                          <Button size="sm" variant="ghost" onClick={() => onStage({ sourceName: name, recordId: "0", scope: defaultId !== "0" && defaultId !== r.recordId ? `${name} leaves record #${r.recordId} · uses the default record` : `${name} leaves record #${r.recordId} · starts blank` })}>
                            leave
                          </Button>
                        ) : null
                      ) : eff !== myId && myId !== "0" ? (
                        <Button size="sm" variant="outline" onClick={() => onStage({ sourceName: r.name, recordId: myId, scope: `${r.name} uses ${name}'s records (#${myId})` })}>
                          use {name}'s records
                        </Button>
                      ) : eff === myId && r.recordId !== "0" ? (
                        <Button size="sm" variant="ghost" onClick={() => onStage({ sourceName: r.name, recordId: "0", scope: defaultId !== "0" && defaultId !== r.recordId ? `${r.name} stops sharing · uses the default record` : `${r.name} stops sharing · starts blank` })}>
                          detach
                        </Button>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })}
            {sorted.length === 0 && q.trim() ? (
              <TableRow><TableCell colSpan={canLink ? 4 : 3} className="text-ink-dim">nothing matches "{q.trim()}"</TableCell></TableRow>
            ) : null}
          </TableBody>
        </Table>
      )}
      {!loading ? <Pager page={pager.page} pages={pager.pages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} /> : null}
    </div>
  )
}

export { SharedFigure }
