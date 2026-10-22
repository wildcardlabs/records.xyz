import { useState } from "react"
import { getAddress, isAddress } from "viem"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusText } from "@/components/wrap"
import { featuredAddressDefs } from "@/lib/ens/profile"
import { TEXT_SPECS } from "@/lib/records"
import { type AccessChange, type Power, POWER_LABEL, ROOT_RESOURCE, bitmapFor, coinResource, keyResource } from "@/lib/ens/roles"

type Kind = "text" | "address" | "data"
const KINDS: { kind: Kind; power: Power; label: string; hint: string }[] = [
  { kind: "text", power: "text", label: "text records", hint: "description, avatar, socials, any text key" },
  { kind: "address", power: "address", label: "payment addresses", hint: "the address people pay, per chain" },
  { kind: "data", power: "data", label: "owned accounts", hint: "the ENSIP-28 listings and proofs" },
]

const select = "h-10 border border-line bg-paper px-3 font-mono text-[12.5px] font-medium lowercase text-ink outline-none focus-visible:border-blue"

/**
 * Stage a role grant on the name's ENSv2 resolver. Scope is either every key (root resource)
 * or one key / one chain. Grants apply to every name served by this resolver instance.
 */
function GrantDialog({
  open,
  onOpenChange,
  name,
  recordsChainId,
  onStage,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  name: string
  recordsChainId: number
  onStage: (c: AccessChange) => void
}) {
  const [account, setAccount] = useState("")
  const [kind, setKind] = useState<Kind>("text")
  const [scope, setScope] = useState<"all" | "one">("all")
  const [textKey, setTextKey] = useState("avatar")
  const [customKey, setCustomKey] = useState("")
  const [coinType, setCoinType] = useState(60)
  const [withAdmin, setWithAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chains = featuredAddressDefs(recordsChainId).map((d) => ({ coinType: d.arg as number, label: d.label }))
  const k = KINDS.find((x) => x.kind === kind)!

  function stage() {
    setError(null)
    if (!isAddress(account)) return setError("enter a valid wallet address")
    let resource = ROOT_RESOURCE
    let scopeLabel = "all keys"
    if (scope === "one") {
      if (kind === "text") {
        const key = textKey === "__custom" ? customKey.trim() : textKey
        if (!key) return setError("enter the text key")
        resource = keyResource(key)
        scopeLabel = `text key ${key}`
      } else if (kind === "address") {
        resource = coinResource(coinType)
        scopeLabel = `${chains.find((c) => c.coinType === coinType)?.label ?? `coin ${coinType}`} address`
      } else {
        return setError("owned accounts can only be delegated for all keys")
      }
    }
    onStage({
      account: getAddress(account),
      resource: resource.toString(),
      roleBitmap: bitmapFor([k.power], withAdmin).toString(),
      revoke: false,
      scope: `${POWER_LABEL[k.power]} · ${scopeLabel}${withAdmin ? " · may delegate" : ""}`,
    })
    onOpenChange(false)
    setAccount("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="font-mono">
        <DialogHeader>
          <DialogTitle className="t-h3 lowercase">Let another wallet edit {name}</DialogTitle>
          <DialogDescription className="t-body">
            Give one wallet permission to change a specific kind of record, without handing over the name. The owner publishes the grant and can revoke it later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="grant-account">wallet to allow</Label>
            <Input id="grant-account" value={account} placeholder="0x…" className="tabular" onChange={(e) => setAccount(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>what it may change</Label>
            <div className="grid gap-1.5">
              {KINDS.map((x) => (
                <label key={x.kind} className="flex cursor-pointer items-start gap-2 text-[12px]">
                  <input type="radio" name="kind" className="mt-1 accent-[var(--blue)]" checked={kind === x.kind} onChange={() => { setKind(x.kind); if (x.kind === "data") setScope("all") }} />
                  <span><span className="font-semibold">{x.label}</span> <span className="text-ink-dim">· {x.hint}</span></span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>scope</Label>
            <div className="flex flex-wrap gap-4 text-[12px]">
              <label className="flex cursor-pointer items-center gap-2"><input type="radio" name="scope" className="accent-[var(--blue)]" checked={scope === "all"} onChange={() => setScope("all")} /> every key</label>
              <label className={`flex items-center gap-2 ${kind === "data" ? "opacity-50" : "cursor-pointer"}`}><input type="radio" name="scope" className="accent-[var(--blue)]" disabled={kind === "data"} checked={scope === "one"} onChange={() => setScope("one")} /> one key only</label>
            </div>
            {scope === "one" && kind === "text" ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <select className={select} value={textKey} onChange={(e) => setTextKey(e.target.value)}>
                  {TEXT_SPECS.map((f) => <option key={f.key} value={f.key}>{f.label} · {f.key}</option>)}
                  <option value="__custom">other key…</option>
                </select>
                {textKey === "__custom" ? <Input value={customKey} placeholder="key, e.g. com.linkedin" onChange={(e) => setCustomKey(e.target.value)} /> : null}
              </div>
            ) : null}
            {scope === "one" && kind === "address" ? (
              <select className={select} value={coinType} onChange={(e) => setCoinType(Number(e.target.value))}>
                {chains.map((c) => <option key={c.coinType} value={c.coinType}>{c.label}</option>)}
              </select>
            ) : null}
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-[12px]">
            <input type="checkbox" className="mt-1 accent-[var(--blue)]" checked={withAdmin} onChange={(e) => setWithAdmin(e.target.checked)} />
            <span>also let it delegate this permission to others <span className="text-ink-dim">· usually off</span></span>
          </label>
          <p className="t-caption normal-case tracking-normal">
            permissions live on the resolver, not the name: they apply to every name this resolver serves for you.
          </p>
          {error ? <StatusText tone="err" className="text-[12px]">{error}</StatusText> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>cancel</Button>
          <Button variant="accent" onClick={stage}>stage grant</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { GrantDialog }
