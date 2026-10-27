import { AddressLink } from "@/components/wrap"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useConnection, useSignTypedData, useSwitchChain } from "wagmi"
import type { Hex } from "viem"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { StatusText } from "@/components/wrap"
import { ACCOUNT_CHAINS, chainById } from "@/lib/ens/chains"
import { publicClient } from "@/lib/ens/clients"
import { consentTypedData, validateConsentSignature } from "@/lib/ensip28"
import { asChainId } from "@/lib/wagmi"
import { fmtDate, nowSeconds, shortAddr } from "@/lib/format"
import type { Draft } from "@/hooks/useDrafts"
import type { AccountKind } from "@/hooks/useRecord"

const PRESETS = [
  { label: "90 days", secs: 90n * 86400n },
  { label: "180 days", secs: 180n * 86400n },
  { label: "1 year", secs: 365n * 86400n },
  { label: "2 years (max)", secs: 2n * 365n * 86400n - 3600n },
]

async function detectKind(chainId: number, account: `0x${string}`): Promise<AccountKind> {
  try {
    const code = await publicClient(chainId).getCode({ address: account })
    if (!code || code === "0x") return "eoa"
    return code.toLowerCase().startsWith("0xef0100") ? "7702" : "contract"
  } catch {
    return "eoa"
  }
}

/**
 * Sign an ENSIP-28 consent from the connected account and hand back a draft.
 * The connected wallet IS the account being listed: the spec requires the account itself to sign.
 */
function AddAccountDialog({
  open,
  onOpenChange,
  name,
  node,
  recordsChainId,
  initialChainId,
  onSigned,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  name: string
  node: Hex
  recordsChainId: number
  initialChainId?: number
  onSigned: (d: Draft) => void
}) {
  const { address, chainId: walletChainId, isConnected } = useConnection()
  const { signTypedDataAsync } = useSignTypedData()
  const { switchChainAsync } = useSwitchChain()
  const [chainId, setChainId] = useState(initialChainId ?? ACCOUNT_CHAINS[0].chain.id)
  const [preset, setPreset] = useState(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      if (initialChainId) setChainId(initialChainId)
    }
  }, [open, initialChainId])

  const recordsChain = chainById(recordsChainId)
  const expiresAt = nowSeconds() + PRESETS[preset].secs

  async function sign() {
    if (!address) return
    setBusy(true)
    setError(null)
    try {
      // Wallets such as MetaMask refuse typed data whose domain chainId differs from the active chain.
      if (walletChainId !== recordsChainId) {
        try {
          await switchChainAsync({ chainId: asChainId(recordsChainId) })
        } catch {
          /* fall through: some wallets sign regardless of the active chain */
        }
      }
      const message = { node, accountChainId: BigInt(chainId), account: address, expiresAt }
      const typed = consentTypedData(recordsChainId, message)
      const signature = await signTypedDataAsync(typed)
      const ok = await validateConsentSignature(publicClient(chainId), address, typed, signature)
      if (!ok) {
        setError(`the signature does not verify for ${shortAddr(address)} on ${chainById(chainId)?.label}. contract accounts must be deployed on that chain.`)
        return
      }
      const kind = await detectKind(chainId, address)
      onSigned({ chainId, account: address, kind, expiresAt: expiresAt.toString(), signature, signedAt: Date.now() })
      toast.success("consent signed", { description: `${shortAddr(address)} on ${chainById(chainId)?.label} · expires ${fmtDate(expiresAt)}` })
      onOpenChange(false)
    } catch (e) {
      setError((e as Error).message?.split("\n")[0] ?? "signing failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="font-mono">
        <DialogHeader>
          <DialogTitle className="t-h3 lowercase">Verify this wallet belongs to {name}</DialogTitle>
          <DialogDescription className="t-body">
            Sign a message saying this wallet belongs to {name} until the date you pick. Free; nothing goes onchain until the owner publishes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>wallet being verified (the one connected now)</Label>
            {isConnected && address ? (
              <div className="border border-line bg-paper-2 px-3 py-2 text-[12px] tabular"><AddressLink address={address} full className="font-medium" /></div>
            ) : (
              <StatusText tone="err" className="text-[12px]">connect the wallet you want to verify first.</StatusText>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="chain">which chain is this wallet on?</Label>
            <select
              id="chain"
              value={chainId}
              onChange={(e) => setChainId(Number(e.target.value))}
              className="h-10 border border-line bg-paper px-3 font-mono text-[12.5px] font-medium lowercase text-ink outline-none focus-visible:border-blue"
            >
              {ACCOUNT_CHAINS.map((c) => (
                <option key={c.chain.id} value={c.chain.id}>{c.label} · {c.chain.id}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expiry">how long should this consent last?</Label>
            <select
              id="expiry"
              value={preset}
              onChange={(e) => setPreset(Number(e.target.value))}
              className="h-10 border border-line bg-paper px-3 font-mono text-[12.5px] font-medium lowercase text-ink outline-none focus-visible:border-blue"
            >
              {PRESETS.map((p, i) => (
                <option key={p.label} value={i}>{p.label} · until {fmtDate(nowSeconds() + p.secs)}</option>
              ))}
            </select>
            <span className="t-caption normal-case tracking-normal">a consent cannot be cancelled, only left to expire · pick the shortest window that works</span>
          </div>
          <div className="t-caption normal-case tracking-normal">your wallet may ask to switch to {recordsChain?.label} first · the message is tied to the name's network</div>
          {error ? <StatusText tone="err" className="text-[12px]">{error}</StatusText> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>cancel</Button>
          <Button variant="accent" disabled={!isConnected || busy} onClick={sign}>
            {busy ? "check your wallet…" : "sign consent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { AddAccountDialog }
