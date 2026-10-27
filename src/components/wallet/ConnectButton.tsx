import { Link } from "react-router-dom"
import { useConnect, useConnection, useDisconnect } from "wagmi"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { chainById } from "@/lib/ens/chains"
import { shortAddr } from "@/lib/format"

/** Wallet menu in the nav: connector list when disconnected, address + chain + disconnect when connected. */
function ConnectButton() {
  const { address, chainId, isConnected, connector } = useConnection()
  const { connectors, connectAsync, isPending } = useConnect()
  const { disconnect } = useDisconnect()
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
            <DropdownMenuItem render={<Link to={`/${address}`} />}>your names</DropdownMenuItem>
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
