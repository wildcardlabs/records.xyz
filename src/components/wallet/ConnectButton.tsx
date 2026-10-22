import { Link } from "react-router-dom"
import { useConnect, useConnection, useDisconnect } from "wagmi"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { chainById, DEFAULT_RECORDS_CHAIN } from "@/lib/ens/chains"
import { useMyNames } from "@/hooks/useMyNames"
import { shortAddr } from "@/lib/format"

/** Wallet menu in the nav: connector list when disconnected, address + chain + disconnect when connected. */
function ConnectButton() {
  const { address, chainId, isConnected, connector } = useConnection()
  const { connectors, connectAsync, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const mine = useMyNames(address)
  // wallets found by EIP-6963 discovery each get their own entry; the generic "injected" entry is only
  // useful when nothing was discovered, and it does nothing at all when no wallet is installed
  const discovered = connectors.filter((c) => c.type === "injected" && c.id !== "injected")
  const hasProvider = typeof window !== "undefined" && !!(window as unknown as { ethereum?: unknown }).ethereum
  const visible = connectors.filter((c) => {
    if (c.id === "injected") return discovered.length === 0 && hasProvider
    return true
  })

  if (isConnected && address) {
    const chain = chainId ? chainById(chainId) : undefined
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          <span className="dot text-ok" />
          {shortAddr(address)}
          <span className="text-ink-dim">· {chain?.label ?? `chain ${chainId}`}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52 font-mono text-[12px]">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="t-label text-ink-dim">{connector?.name ?? "wallet"}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard?.writeText(address)}>copy address</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className="t-label text-ink-dim">your names</DropdownMenuLabel>
            {mine.isLoading ? (
              <DropdownMenuItem disabled>looking up…</DropdownMenuItem>
            ) : (mine.data?.names.length ?? 0) === 0 ? (
              <DropdownMenuItem disabled>none found{mine.data && mine.data.indexedChains.length > 0 ? "" : " · primary name only"}</DropdownMenuItem>
            ) : (
              mine.data!.names.slice(0, 12).map((n) => {
                const meta = chainById(n.chainId)
                const to = `/${n.name}${meta && meta.chain.id !== DEFAULT_RECORDS_CHAIN.chain.id ? `?net=${meta.slug}` : ""}`
                return (
                  <DropdownMenuItem key={`${n.chainId}:${n.name}`} render={<Link to={to} />}>
                    <span className="truncate">{n.name}</span>
                    <span className="ml-auto pl-3 text-ink-dim">{meta?.label ?? n.chainId}{n.authority === "ens_v2" ? " · v2" : ""}</span>
                  </DropdownMenuItem>
                )
              })
            )}
            {mine.data && mine.data.names.length > 12 ? <DropdownMenuItem disabled>and {mine.data.names.length - 12} more</DropdownMenuItem> : null}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => disconnect()}>disconnect</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button disabled={isPending} />}>{isPending ? "connecting…" : "connect wallet"}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52 font-mono text-[12px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="t-label text-ink-dim">choose a wallet</DropdownMenuLabel>
          {visible.map((c) => (
            <DropdownMenuItem
              key={c.uid}
              onClick={() =>
                connectAsync({ connector: c }).catch((e: Error) => {
                  const msg = e.message?.split("\n")[0] ?? "connection failed"
                  toast.error(`${c.name.toLowerCase()}: ${/rejected|denied/i.test(msg) ? "request rejected in the wallet" : msg.slice(0, 140)}`)
                })
              }
            >
              {c.name.toLowerCase()}
            </DropdownMenuItem>
          ))}
          {visible.length === 0 ? <DropdownMenuItem disabled>no wallet found in this browser</DropdownMenuItem> : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { ConnectButton }
