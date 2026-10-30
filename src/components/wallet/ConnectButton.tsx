import { Link } from "react-router-dom"
import { useState } from "react"
import { useConnect, useConnection, useDisconnect, useEnsAvatar, useEnsName } from "wagmi"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { shortAddr } from "@/lib/format"

/** DiceBear "waves" art seeded with the address, for wallets without an avatar. */
const fallbackAvatar = (address: string) => `https://api.dicebear.com/10.x/waves/svg?seed=${address.toLowerCase()}`

function WalletAvatar({ address, src }: { address: string; src: string | null | undefined }) {
  const [broken, setBroken] = useState(false)
  const url = src && !broken ? src : fallbackAvatar(address)
  return <img referrerPolicy="no-referrer" src={url} alt="" width={20} height={20} className="size-5 shrink-0 border border-line bg-paper object-cover" onError={() => setBroken(true)} />
}

/** Wallet menu in the nav: connector list when disconnected, address + chain + disconnect when connected. */
function ConnectButton() {
  const { address, isConnected, connector } = useConnection()
  const { connectors, connectAsync, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  // the wallet's primary name on mainnet and that name's avatar, when it has them
  const primary = useEnsName({ address, chainId: 1, query: { enabled: !!address, staleTime: 60_000 } })
  const avatar = useEnsAvatar({ name: primary.data ?? undefined, chainId: 1, query: { enabled: !!primary.data, staleTime: 60_000 } })
  // wallets found by EIP-6963 discovery each get their own entry; the generic "injected" entry is only
  // useful when nothing was discovered, and it does nothing at all when no wallet is installed
  const discovered = connectors.filter((c) => c.type === "injected" && c.id !== "injected")
  const hasProvider = typeof window !== "undefined" && !!(window as unknown as { ethereum?: unknown }).ethereum
  const visible = connectors.filter((c) => {
    if (c.id === "injected") return discovered.length === 0 && hasProvider
    return true
  })

  if (isConnected && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          <WalletAvatar address={address} src={avatar.data} />
          {primary.data ?? shortAddr(address)}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52 font-mono text-[12px]">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="t-label text-ink-dim">{connector?.name ?? "wallet"} · {shortAddr(address)}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard?.writeText(address)}>copy address</DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/account" />}>account</DropdownMenuItem>
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
