import { Link } from "react-router-dom"
import { cn } from "cn"
import { getAddress, isAddress } from "viem"
import { shortAddr } from "@/lib/format"

/** A wallet address, shortened, linking to that wallet's names at /0x…; a non-address falls back to plain text. */
function AddressLink({ address, chars = 6, className, full = false }: { address: string; chars?: number; className?: string; full?: boolean }) {
  const text = full ? address : shortAddr(address, chars)
  if (!isAddress(address)) return <span className={cn("tabular font-semibold text-ink", className)}>{text}</span>
  return (
    <Link to={`/${getAddress(address)}`} className={cn("link-blue tabular font-semibold text-ink", className)} title="names owned by this wallet">
      {text}
    </Link>
  )
}

export { AddressLink }
