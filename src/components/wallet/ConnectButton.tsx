import { useConnect, useConnection, useDisconnect } from "wagmi"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { chainById } from "@/lib/ens/chains"
import { shortAddr } from "@/lib/format"

/** Wallet menu in the nav: connector list when disconnected, address + chain + disconnect when connected. */
function ConnectButton() {
  const { address, chainId, isConnected, connector } = useConnection()
  const { connectors, connectAsync, isPending } = useConnect()
  const { disconnect } = useDisconnect()

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
          {connectors.map((c) => (
            <DropdownMenuItem key={c.uid} onClick={() => connectAsync({ connector: c }).catch(() => {})}>
              {c.name.toLowerCase()}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { ConnectButton }
