import { useMemo, useState } from "react"
import { useConnection } from "wagmi"
import { type Address, isAddressEqual, namehash } from "viem"
import { normalize } from "viem/ens"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusText } from "@/components/wrap"
import { publicClient } from "@/lib/ens/clients"
import { type LinkChange, type ResolverLink, linkAbi } from "@/lib/ens/links"
import { matchNames } from "@/components/wallet/MyNames"
import { findResolver } from "@/lib/ens/resolve"
import { useMyNames } from "@/hooks/useMyNames"

/**
 * Stage a record link between this name and another name on the same ENSv2 resolver.
 * Either the other name starts using this name's records, or this name starts using
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
  /** every name bound to this resolver, from the links figure */
  bound,
  onStage,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  name: string
  recordsChainId: number
  resolver: Address
  myRecordId: string
  defaultRecordId: string
  bound: ResolverLink[] | undefined
  onStage: (c: LinkChange) => void
}) {
  const [other, setOther] = useState("")
  const [direction, setDirection] = useState<"theirs-to-mine" | "mine-to-theirs">("theirs-to-mine")
  const { address } = useConnection()
  const mine = useMyNames(address)
  // your names that this resolver already serves: the indexer lists every bound name, so no lookups are needed.
  // names you own that were never written to are not bound yet; they go through the typed field instead.
  const picks = useMemo(() => {
    const boundNames = new Set((bound ?? []).filter((r) => !r.isDefault).map((r) => r.name))
    return (mine.data?.names ?? []).filter((n) => n.chainId === recordsChainId && n.name !== name && boundNames.has(n.name))
  }, [mine.data, bound, recordsChainId, name])
  const matches = useMemo(() => matchNames(picks, other), [picks, other])
  const manyPicks = picks.length > 8
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
        if (myRecordId === "0") return setError(`${name} has no profile yet. edit and publish one first.`)
        if (theirs === myRecordId) return setError(`${target} already uses ${name}'s profile.`)
        onStage({ sourceName: target, recordId: myRecordId, scope: `${target} uses ${name}'s profile` })
      } else {
        if (theirs === "0") return setError(`${target} has no profile yet.`)
        if (theirs === myRecordId) return setError(`${name} already uses ${target}'s profile.`)
        onStage({ sourceName: name, recordId: theirs, scope: `${name} uses ${target}'s profile` })
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
          <DialogTitle className="t-h3 lowercase">Share this profile with another name</DialogTitle>
          <DialogDescription className="t-body">
            Both names read and write one profile: edit it under either and both change.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="link-name">the other name</Label>
            <Input id="link-name" value={other} placeholder={manyPicks ? `type to filter your ${picks.length} names here, or any name` : "alice.eth"} onChange={(e) => setOther(e.target.value)} />
            {picks.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-ink-dim">yours on this resolver{manyPicks ? ` (${matches.length} of ${picks.length})` : ""}:</span>
                {(manyPicks ? matches : picks).map((n) => (
                  <button key={n.name} type="button" className={`border px-2 py-0.5 ${other === n.name ? "border-blue text-blue" : "border-line text-ink-muted hover:border-blue hover:text-blue"}`} onClick={() => setOther(n.name)}>
                    {n.name}
                  </button>
                ))}
                {manyPicks && matches.length === 0 ? <span className="text-ink-dim">nothing matches</span> : null}
              </div>
            ) : address && mine.isLoading ? (
              <span className="t-caption normal-case tracking-normal">looking up your names…</span>
            ) : address && (mine.data?.names.length ?? 0) > 1 ? (
              <span className="t-caption normal-case tracking-normal">none of your other names uses this resolver · type any name</span>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label>which records survive</Label>
            <div className="grid gap-1.5 text-[12px]">
              <label className="flex cursor-pointer items-start gap-2">
                <input type="radio" name="direction" className="mt-1 accent-[var(--blue)]" checked={direction === "theirs-to-mine"} onChange={() => setDirection("theirs-to-mine")} />
                <span><span className="font-semibold">{name}'s</span> <span className="text-ink-dim">· the other name starts using {name}'s profile</span></span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input type="radio" name="direction" className="mt-1 accent-[var(--blue)]" checked={direction === "mine-to-theirs"} onChange={() => setDirection("mine-to-theirs")} />
                <span><span className="font-semibold">the other name's</span> <span className="text-ink-dim">· {name} starts using the other name's profile</span></span>
              </label>
            </div>
          </div>
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
