import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useConnection } from "wagmi"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useMyNames } from "@/hooks/useMyNames"
import { DEFAULT_RECORDS_CHAIN, chainById } from "@/lib/ens/chains"
import type { MyName } from "@/lib/ens/names"

export const pathFor = (n: MyName) => {
  const meta = chainById(n.chainId)
  return `/${n.name}${meta && meta.chain.id !== DEFAULT_RECORDS_CHAIN.chain.id ? `?net=${meta.slug}` : ""}`
}

const MAX_CHIPS = 6
const MAX_MATCHES = 8

/** Names matching a typed needle, best first: exact, then prefix, then anywhere. */
export function matchNames(names: MyName[], needle: string, limit = MAX_MATCHES): MyName[] {
  const q = needle.trim().toLowerCase()
  if (!q) return names.slice(0, limit)
  const score = (n: string) => (n === q ? 3 : n.startsWith(q) ? 2 : n.includes(q) ? 1 : 0)
  return names
    .map((n) => ({ n, s: score(n.name) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.n.name.localeCompare(b.n.name))
    .slice(0, limit)
    .map((x) => x.n)
}

/**
 * Jump between the connected wallet's names from a record page: chips when there are a few,
 * a search box when there are many, and always a link to the full list at /names.
 */
function MyNameChips({ exclude }: { exclude?: { name: string; chainId: number } }) {
  const { address, isConnected } = useConnection()
  const mine = useMyNames(address)
  const nav = useNavigate()
  const [q, setQ] = useState("")
  const names = useMemo(
    () => (mine.data?.names ?? []).filter((n) => !(exclude && n.name === exclude.name && n.chainId === exclude.chainId)),
    [mine.data, exclude]
  )
  const matches = useMemo(() => matchNames(names, q), [names, q])
  // only on a name the wallet owns or manages: "your other names" makes no sense on a stranger's record
  const owns = !exclude || (mine.data?.names ?? []).some((n) => n.name === exclude.name && n.chainId === exclude.chainId)
  if (!isConnected || !address || mine.isLoading || names.length === 0 || !owns) return null
  const total = names.length + (exclude ? 1 : 0)

  if (names.length <= MAX_CHIPS) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-ink-dim">your other names:</span>
        {names.map((n) => (
          <Link key={`${n.chainId}:${n.name}`} className="link-blue" to={pathFor(n)}>
            <Badge variant="outline">{n.name}{n.chainId !== DEFAULT_RECORDS_CHAIN.chain.id ? ` · ${chainById(n.chainId)?.label}` : ""}</Badge>
          </Link>
        ))}
        <Link className="link-blue text-ink" to="/names">all names</Link>
      </div>
    )
  }

  return (
    <div className="mt-4 max-w-md text-[11px]">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-ink-dim">your other names:</span>
        <div className="relative flex-1">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`jump to one of ${names.length}…`}
            aria-label="jump to another of your names"
            className="h-8 text-[12px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) nav(pathFor(matches[0]))
              if (e.key === "Escape") setQ("")
            }}
          />
          {q.trim() ? (
            <ul className="absolute right-0 left-0 z-20 mt-1 max-h-64 overflow-auto border border-line bg-paper shadow-sm">
              {matches.length === 0 ? (
                <li className="px-3 py-2 text-ink-dim">nothing matches</li>
              ) : (
                matches.map((n) => (
                  <li key={`${n.chainId}:${n.name}`}>
                    <Link to={pathFor(n)} className="flex items-baseline justify-between gap-3 px-3 py-2 text-[12px] hover:bg-wash" onClick={() => setQ("")}>
                      <span className="font-semibold text-ink">{n.name}</span>
                      <span className="text-ink-dim">{chainById(n.chainId)?.label}{n.authority === "ens_v2" ? " · v2" : ""}</span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
        <Link className="link-blue shrink-0 text-ink" to="/names">all {total} names</Link>
      </div>
    </div>
  )
}

export { MyNameChips }
