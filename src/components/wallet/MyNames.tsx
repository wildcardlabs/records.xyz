import { Link } from "react-router-dom"
import { useConnection } from "wagmi"
import { Badge } from "@/components/ui/badge"
import { LivePill } from "@/components/wrap"
import { useMyNames } from "@/hooks/useMyNames"
import { DEFAULT_RECORDS_CHAIN, chainById } from "@/lib/ens/chains"
import type { MyName } from "@/lib/ens/names"
import { shortAddr } from "@/lib/format"

export const pathFor = (n: MyName) => {
  const meta = chainById(n.chainId)
  return `/${n.name}${meta && meta.chain.id !== DEFAULT_RECORDS_CHAIN.chain.id ? `?net=${meta.slug}` : ""}`
}

/**
 * The connected wallet's names, in the open: a list on the home page under the lookup box,
 * or a row of chips on a record page to jump between your names.
 */
function MyNames({ variant, exclude }: { variant: "list" | "chips"; exclude?: { name: string; chainId: number } }) {
  const { address, isConnected } = useConnection()
  const mine = useMyNames(address)
  if (!isConnected || !address) return null
  const names = (mine.data?.names ?? []).filter((n) => !(exclude && n.name === exclude.name && n.chainId === exclude.chainId))
  const indexed = (mine.data?.indexedChains.length ?? 0) > 0

  if (variant === "chips") {
    if (mine.isLoading || names.length === 0) return null
    return (
      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-ink-dim">your other names:</span>
        {names.slice(0, 8).map((n) => (
          <Link key={`${n.chainId}:${n.name}`} className="link-blue" to={pathFor(n)}>
            <Badge variant="outline">{n.name}{n.chainId !== DEFAULT_RECORDS_CHAIN.chain.id ? ` · ${chainById(n.chainId)?.label}` : ""}</Badge>
          </Link>
        ))}
        {names.length > 8 ? <span className="text-ink-dim">and {names.length - 8} more</span> : null}
      </div>
    )
  }

  return (
    <div className="mt-6 max-w-xl border border-line bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
        <span className="t-label text-ink-dim">your names</span>
        <span className="t-caption normal-case tracking-normal">{shortAddr(address, 4)}{indexed ? " · owned or managed, from the indexer" : " · primary name only"}</span>
      </div>
      {mine.isLoading ? (
        <div className="space-y-2 p-4"><div className="h-3 w-48 bg-wash" /><div className="h-3 w-32 bg-wash" /></div>
      ) : names.length === 0 ? (
        <p className="t-fig-body p-4 text-ink-dim">no names found for this wallet{indexed ? "" : " on mainnet. names on sepolia show once the indexer lists them"}.</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {names.map((n) => (
            <li key={`${n.chainId}:${n.name}`}>
              <Link to={pathFor(n)} className="flex items-center gap-3 px-4 py-2.5 text-[12px] hover:bg-wash">
                <span className="font-semibold text-ink">{n.name}</span>
                {n.isPrimary ? <LivePill pulse={false}>primary</LivePill> : null}
                <span className="ml-auto text-ink-dim">{chainById(n.chainId)?.label ?? n.chainId}{n.authority === "ens_v2" ? " · v2" : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export { MyNames }
