import { useState } from "react"
import { type Address, isAddressEqual, namehash } from "viem"
import { normalize } from "viem/ens"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusText } from "@/components/wrap"
import { publicClient } from "@/lib/ens/clients"
import { type LinkChange, linkAbi } from "@/lib/ens/links"
import { findResolver } from "@/lib/ens/resolve"

/**
 * Stage a record link between this name and another name on the same ENSv2 resolver.
 * Either the other name starts showing this name's records, or this name starts showing
 * the other's. The owner publishes the link like any other change.
 */
function LinkDialog({
  open,
  onOpenChange,
  name,
  recordsChainId,
  resolver,
  /** record id this name reads right now ("0" when it has none) */
  myRecordId,
  /** the default record's id ("0" when none) */
  defaultRecordId,
  onStage,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  name: string
  recordsChainId: number
  resolver: Address
  myRecordId: string
  defaultRecordId: string
  onStage: (c: LinkChange) => void
}) {
  const [other, setOther] = useState("")
  const [direction, setDirection] = useState<"theirs-to-mine" | "mine-to-theirs">("theirs-to-mine")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function stage() {
    setError(null)
    let target: string
    try {
      target = normalize(other.trim())
    } catch {
      return setError("that is not a valid ENS name")
    }
    if (!target || target === name) return setError("enter a different name")
    setBusy(true)
    try {
      const client = publicClient(recordsChainId)
      const theirResolver = await findResolver(client, target)
      if (!theirResolver || !isAddressEqual(theirResolver, resolver)) {
        return setError(`${target} does not use this resolver. records can only be shared between names on the same resolver.`)
      }
      const theirOwn = (await client.readContract({ address: resolver, abi: linkAbi, functionName: "getRecordId", args: [namehash(target)] })).toString()
      const theirs = theirOwn !== "0" ? theirOwn : defaultRecordId
      if (direction === "theirs-to-mine") {
        if (myRecordId === "0") return setError(`${name} has no records yet. edit a record and publish first.`)
        if (theirs === myRecordId) return setError(`${target} already shows ${name}'s records.`)
        onStage({ sourceName: target, recordId: myRecordId, scope: `${target} shows ${name}'s records (#${myRecordId})` })
      } else {
        if (theirs === "0") return setError(`${target} has no records yet.`)
        if (theirs === myRecordId) return setError(`${name} already shows ${target}'s records.`)
        onStage({ sourceName: name, recordId: theirs, scope: `${name} shows ${target}'s records (#${theirs})` })
      }
      onOpenChange(false)
      setOther("")
    } catch (e) {
      setError((e as Error).message.split("\n")[0].slice(0, 160))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="font-mono">
        <DialogHeader>
          <DialogTitle className="t-h3 lowercase">Share records with another name</DialogTitle>
          <DialogDescription className="t-body">
            Two names on this resolver can read and write one record. Edit the profile under either name and both change. Owned accounts, payment addresses and every other record are shared too.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="link-name">the other name</Label>
            <Input id="link-name" value={other} placeholder="alice.eth" onChange={(e) => setOther(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>which records survive</Label>
            <div className="grid gap-1.5 text-[12px]">
              <label className="flex cursor-pointer items-start gap-2">
                <input type="radio" name="direction" className="mt-1 accent-[var(--blue)]" checked={direction === "theirs-to-mine"} onChange={() => setDirection("theirs-to-mine")} />
                <span><span className="font-semibold">{name}'s</span> <span className="text-ink-dim">· the other name starts showing what {name} shows today</span></span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input type="radio" name="direction" className="mt-1 accent-[var(--blue)]" checked={direction === "mine-to-theirs"} onChange={() => setDirection("mine-to-theirs")} />
                <span><span className="font-semibold">the other name's</span> <span className="text-ink-dim">· {name} starts showing what the other name shows today</span></span>
              </label>
            </div>
          </div>
          <p className="t-caption normal-case tracking-normal">
            the record left behind is not deleted; it is just no longer read by that name. owned accounts stay valid only if the consents were signed for the name that shows them.
          </p>
          {error ? <StatusText tone="err" className="text-[12px]">{error}</StatusText> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>cancel</Button>
          <Button variant="accent" disabled={busy || !other.trim()} onClick={stage}>{busy ? "checking…" : "stage link"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { LinkDialog }
