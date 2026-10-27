import { AddressLink } from "@/components/wrap"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useConnection } from "wagmi"
import type { Address } from "viem"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Figure, LivePill, Pager, Section, SectionHeader, StatRow, StatusText, V2, usePager } from "@/components/wrap"
import { ConnectButton } from "@/components/wallet/ConnectButton"
import { pathFor } from "@/components/wallet/MyNames"
import { useMyNames } from "@/hooks/useMyNames"
import { chainById } from "@/lib/ens/chains"
import { daysUntil, fmtDate, shortAddr } from "@/lib/format"

/**
 * Every name a wallet owns or manages, with a filter for wallets that hold hundreds.
 * `/names` shows the connected wallet; `/0x…` shows any address, no wallet needed.
 */
export default function NamesPage({ address: given }: { address?: Address } = {}) {
  const { address: connected, isConnected } = useConnection()
  const address = given ?? (isConnected ? connected : undefined)
  const isYou = !!given && !!connected && given.toLowerCase() === connected.toLowerCase()
  const mine = useMyNames(address)
  const [q, setQ] = useState("")
  const [chain, setChain] = useState<number | "all">("all")

  const names = mine.data?.names ?? []
  const chains = useMemo(() => [...new Set(names.map((n) => n.chainId))], [names])
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return names.filter((n) => (chain === "all" || n.chainId === chain) && (!needle || n.name.includes(needle)))
  }, [names, q, chain])
  const pager = usePager(shown)
  const v2 = names.filter((n) => n.authority === "ens_v2").length
  const indexed = (mine.data?.indexedChains.length ?? 0) > 0

  return (
    <Section>
      <SectionHeader
        eyebrow={given && !isYou ? "names" : "your names"}
        title={given && !isYou ? `Names of ${shortAddr(given, 4)}` : "Your names"}
        lede={address ? (given && !isYou ? `Every ENS name ${shortAddr(given, 4)} owns or manages. Open one to read its record.` : "Every ENS name you own or manage. Open one to read or edit its record.") : "Connect your wallet to see the names you own or manage."}
      />
      {!address ? (
        <ConnectButton />
      ) : (
        <>
          <StatRow
            className="mb-6"
            stats={[
              { label: "wallet", value: <AddressLink address={address} chars={4} />, hint: isYou ? "you" : undefined },
              { label: "names", value: mine.isLoading ? "…" : String(names.length) },
              { label: "on ensv2", value: mine.isLoading ? "…" : String(v2) },
              { label: "source", value: indexed ? "bigname" : "primary only", hint: indexed ? "owned and managed names" : "no indexer on this chain yet" },
            ]}
          />
          <Figure n={1} name={`names · ${shortAddr(address, 4)}`} padded={false} dotted={false}>
            <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:px-5">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter by name" aria-label="filter names" className="h-9 sm:max-w-xs" />
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {chains.length > 1 ? (["all", ...chains] as (number | "all")[]).map((c) => (
                  <button key={String(c)} type="button" onClick={() => setChain(c)} className={`border px-2 py-0.5 ${chain === c ? "border-blue text-blue" : "border-line text-ink-muted hover:border-blue hover:text-blue"}`}>
                    {c === "all" ? "every chain" : chainById(c)?.label ?? c}
                  </button>
                )) : null}
              </div>
              <span className="t-caption normal-case tracking-normal sm:ml-auto">{mine.isLoading ? "looking up…" : shown.length === names.length ? `${names.length} ${names.length === 1 ? "name" : "names"}` : `${shown.length} of ${names.length}`}</span>
            </div>
            {mine.isLoading ? (
              <div className="space-y-2 p-4"><div className="h-3 w-56 bg-wash" /><div className="h-3 w-40 bg-wash" /><div className="h-3 w-48 bg-wash" /></div>
            ) : mine.isError ? (
              <div className="p-4 text-[12px]"><StatusText tone="err">could not list names.</StatusText> <button type="button" className="link-blue text-ink" onClick={() => mine.refetch()}>try again</button></div>
            ) : names.length === 0 ? (
              <p className="t-fig-body p-4 text-ink-dim sm:p-5">{given && !isYou ? "this wallet owns or manages no names" : "you own or manage no names yet"}{indexed ? "" : " · without an indexer only the primary name can be found"}.</p>
            ) : shown.length === 0 ? (
              <p className="t-fig-body p-4 text-ink-dim sm:p-5">nothing matches.</p>
            ) : (
              <Table stack>
                <TableHeader>
                  <TableRow>
                    <TableHead>name</TableHead>
                    <TableHead>chain</TableHead>
                    <TableHead>role</TableHead>
                    <TableHead>expires</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pager.slice.map((n) => (
                    <TableRow key={`${n.chainId}:${n.name}`}>
                      <TableCell data-label="name">
                        <span className="inline-flex items-center gap-2">
                          <Link className="link-blue font-semibold text-ink" to={pathFor(n)}>{n.name}</Link>
                          {n.isPrimary ? <LivePill pulse={false}>primary</LivePill> : null}
                        </span>
                      </TableCell>
                      <TableCell data-label="chain">
                        <span className="inline-flex items-center gap-1.5"><span className="dot text-blue-2" />{chainById(n.chainId)?.label ?? n.chainId}{n.authority === "ens_v2" ? <V2 /> : null}</span>
                      </TableCell>
                      <TableCell data-label="role">{n.relations.length ? n.relations.join(" · ") : "—"}</TableCell>
                      <TableCell data-label="expires">
                        {n.expiresAt ? (
                          daysUntil(n.expiresAt) < 0 ? (
                            <span className="text-err">{fmtDate(n.expiresAt)} · expired</span>
                          ) : (
                            <span className={daysUntil(n.expiresAt) < 30 ? "text-wait" : undefined}>{fmtDate(n.expiresAt)} · {daysUntil(n.expiresAt)} days</span>
                          )
                        ) : (
                          <span className="text-ink-dim">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" render={<Link to={pathFor(n)} />}>open</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!mine.isLoading && shown.length > 0 ? <Pager page={pager.page} pages={pager.pages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} /> : null}
          </Figure>
          <p className="t-caption mt-3 normal-case tracking-normal">
            from <a className="link-blue" href="https://bigname.sh" target="_blank" rel="noreferrer">bigname</a>
          </p>
        </>
      )}
    </Section>
  )
}
