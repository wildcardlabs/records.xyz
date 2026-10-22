import { Link } from "react-router-dom"
import { useConnection } from "wagmi"
import { Badge } from "@/components/ui/badge"
import { useMyNames } from "@/hooks/useMyNames"
import { DEFAULT_RECORDS_CHAIN, chainById } from "@/lib/ens/chains"
import type { MyName } from "@/lib/ens/names"

export const pathFor = (n: MyName) => {
  const meta = chainById(n.chainId)
  return `/${n.name}${meta && meta.chain.id !== DEFAULT_RECORDS_CHAIN.chain.id ? `?net=${meta.slug}` : ""}`
}

const MAX_CHIPS = 6

/** A short row of the connected wallet's other names, with a link to the full list at /names. */
function MyNameChips({ exclude }: { exclude?: { name: string; chainId: number } }) {
  const { address, isConnected } = useConnection()
  const mine = useMyNames(address)
  if (!isConnected || !address || mine.isLoading) return null
  const names = (mine.data?.names ?? []).filter((n) => !(exclude && n.name === exclude.name && n.chainId === exclude.chainId))
  if (names.length === 0) return null
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-ink-dim">your other names:</span>
      {names.slice(0, MAX_CHIPS).map((n) => (
        <Link key={`${n.chainId}:${n.name}`} className="link-blue" to={pathFor(n)}>
          <Badge variant="outline">{n.name}{n.chainId !== DEFAULT_RECORDS_CHAIN.chain.id ? ` · ${chainById(n.chainId)?.label}` : ""}</Badge>
        </Link>
      ))}
      <Link className="link-blue text-ink" to="/names">{names.length > MAX_CHIPS ? `all ${names.length + (exclude ? 1 : 0)} names` : "all names"}</Link>
    </div>
  )
}

export { MyNameChips }
