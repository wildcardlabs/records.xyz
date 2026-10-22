import { useEffect, useMemo, useState } from "react"
import { isAddress } from "viem"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusText } from "@/components/wrap"
import type { Profile } from "@/lib/ens/profile"
import { coinTypeFor } from "@/lib/ens/profile"

export const TEXT_FIELDS: { key: string; label: string; placeholder: string; wide?: boolean }[] = [
  { key: "description", label: "description", placeholder: "one line about you", wide: true },
  { key: "url", label: "website", placeholder: "https://…", wide: true },
  { key: "avatar", label: "avatar", placeholder: "https://… or eip155:1/erc721:0x…/123", wide: true },
  { key: "header", label: "banner", placeholder: "https://… (wide image)", wide: true },
  { key: "com.twitter", label: "x", placeholder: "handle" },
  { key: "com.github", label: "github", placeholder: "username" },
  { key: "xyz.farcaster", label: "farcaster", placeholder: "username" },
  { key: "org.telegram", label: "telegram", placeholder: "username" },
  { key: "com.discord", label: "discord", placeholder: "username" },
  { key: "email", label: "email", placeholder: "you@example.com" },
]

/** Address records offered per records chain (coin types per ENSIP-11). */
export function addressFields(recordsChainId: number): { coinType: number; label: string }[] {
  if (recordsChainId === 11155111) {
    return [
      { coinType: 60, label: "sepolia" },
      { coinType: coinTypeFor(84532), label: "base sepolia" },
      { coinType: coinTypeFor(11155420), label: "op sepolia" },
      { coinType: coinTypeFor(421614), label: "arbitrum sepolia" },
    ]
  }
  return [
    { coinType: 60, label: "ethereum" },
    { coinType: coinTypeFor(8453), label: "base" },
    { coinType: coinTypeFor(10), label: "optimism" },
    { coinType: coinTypeFor(42161), label: "arbitrum" },
  ]
}

type DraftsApi = {
  texts: Record<string, string>
  addrs: Record<string, string>
  setText: (key: string, value: string | null) => void
  setAddr: (coinType: number, value: string | null) => void
}

/** Current onchain text values keyed by record key, derived from the profile read. */
export function currentTexts(profile: Profile | undefined): Record<string, string> {
  if (!profile) return {}
  const out: Record<string, string> = {}
  if (profile.avatar) out.avatar = profile.avatar
  if (profile.header) out.header = profile.header
  if (profile.description) out.description = profile.description
  if (profile.url) out.url = profile.url
  for (const s of profile.socials) out[s.key] = s.value
  return out
}

export function currentAddrs(profile: Profile | undefined): Record<string, string> {
  if (!profile) return {}
  return Object.fromEntries(profile.addresses.map((a) => [String(a.coinType), a.address]))
}

/**
 * Edit profile text and address records. Changes are staged into the drafts store
 * and written by the same publish transaction as owned accounts.
 */
function ProfileEditor({
  recordsChainId,
  profile,
  drafts,
  enabled,
  disabledReason,
  onDone,
}: {
  recordsChainId: number
  profile: Profile | undefined
  drafts: DraftsApi
  enabled: boolean
  disabledReason?: string
  /** called after a successful stage; the caller usually closes edit mode */
  onDone?: () => void
}) {
  const current = useMemo(() => currentTexts(profile), [profile])
  const currentA = useMemo(() => currentAddrs(profile), [profile])
  const fields = addressFields(recordsChainId)

  const [texts, setTexts] = useState<Record<string, string>>({})
  const [addrs, setAddrs] = useState<Record<string, string>>({})
  const [custom, setCustom] = useState({ key: "", value: "" })
  const [error, setError] = useState<string | null>(null)

  // seed the form from chain values overlaid with staged drafts
  useEffect(() => {
    setTexts({ ...current, ...drafts.texts })
    setAddrs({ ...currentA, ...drafts.addrs })
  }, [current, currentA, drafts.texts, drafts.addrs])

  const customKeys = Object.keys({ ...current, ...drafts.texts, ...texts }).filter((k) => !TEXT_FIELDS.some((f) => f.key === k))

  function stage() {
    setError(null)
    for (const [ct, v] of Object.entries(addrs)) {
      if (v && !isAddress(v)) {
        setError(`"${v.slice(0, 12)}…" is not a valid address for ${fields.find((f) => String(f.coinType) === ct)?.label ?? ct}`)
        return
      }
    }
    const allTextKeys = new Set([...Object.keys(texts), ...Object.keys(current), ...Object.keys(drafts.texts)])
    for (const key of allTextKeys) {
      const next = (texts[key] ?? "").trim()
      const was = current[key] ?? ""
      drafts.setText(key, next === was ? null : next)
    }
    const allAddrKeys = new Set([...Object.keys(addrs), ...Object.keys(currentA), ...Object.keys(drafts.addrs)])
    for (const ct of allAddrKeys) {
      const next = (addrs[ct] ?? "").trim()
      const was = currentA[ct] ?? ""
      drafts.setAddr(Number(ct), next.toLowerCase() === was.toLowerCase() ? null : next)
    }
    onDone?.()
  }

  function addCustom() {
    const key = custom.key.trim()
    if (!key) return
    setTexts((t) => ({ ...t, [key]: custom.value }))
    setCustom({ key: "", value: "" })
  }

  const staged = Object.keys(drafts.texts).length + Object.keys(drafts.addrs).length
  const field = "h-10 border border-line bg-paper px-3 font-mono text-[12.5px] font-medium text-ink outline-none placeholder:text-ink-dim focus-visible:border-blue disabled:opacity-50"

  return (
    <div>
      <div className="grid divide-y divide-line lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:divide-x lg:divide-y-0">
        <div className="p-4 sm:p-5">
          <div className="t-label mb-3 text-ink-dim">profile</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {TEXT_FIELDS.map((f) => (
              <div key={f.key} className={f.wide ? "sm:col-span-2" : undefined}>
                <Label htmlFor={`t-${f.key}`} className="mb-1.5">{f.label}{drafts.texts[f.key] !== undefined ? <span className="text-blue">· staged</span> : null}</Label>
                <Input id={`t-${f.key}`} value={texts[f.key] ?? ""} placeholder={f.placeholder} disabled={!enabled} onChange={(e) => setTexts((t) => ({ ...t, [f.key]: e.target.value }))} />
              </div>
            ))}
            {customKeys.map((k) => (
              <div key={k} className="sm:col-span-2">
                <Label htmlFor={`t-${k}`} className="mb-1.5">{k}{drafts.texts[k] !== undefined ? <span className="text-blue">· staged</span> : null}</Label>
                <Input id={`t-${k}`} value={texts[k] ?? ""} disabled={!enabled} onChange={(e) => setTexts((t) => ({ ...t, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="flex flex-col gap-1.5 sm:col-span-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="custom-key" className="mb-1.5">any other record</Label>
                <input id="custom-key" className={`${field} w-full`} placeholder="key, e.g. com.linkedin" value={custom.key} disabled={!enabled} onChange={(e) => setCustom((c) => ({ ...c, key: e.target.value }))} />
              </div>
              <input className={`${field} flex-1`} placeholder="value" value={custom.value} disabled={!enabled} onChange={(e) => setCustom((c) => ({ ...c, value: e.target.value }))} />
              <Button variant="outline" disabled={!enabled || !custom.key.trim()} onClick={addCustom}>add</Button>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="t-label mb-1 text-ink-dim">payment addresses</div>
          <p className="t-caption mb-3 normal-case tracking-normal">where people pay this name. leave blank to clear a chain.</p>
          <div className="grid gap-3">
            {fields.map((f) => (
              <div key={f.coinType}>
                <Label htmlFor={`a-${f.coinType}`} className="mb-1.5">{f.label}{drafts.addrs[String(f.coinType)] !== undefined ? <span className="text-blue">· staged</span> : null}</Label>
                <Input id={`a-${f.coinType}`} value={addrs[String(f.coinType)] ?? ""} placeholder="0x…" disabled={!enabled} className="tabular" onChange={(e) => setAddrs((a) => ({ ...a, [String(f.coinType)]: e.target.value }))} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 sm:px-5">
        <Button variant={enabled ? "accent" : "outline"} disabled={!enabled} onClick={stage}>save changes for publishing</Button>
        {onDone ? <Button variant="ghost" onClick={onDone}>cancel</Button> : null}
        {staged > 0 ? <span className="text-[12px] text-ink-muted">{staged} {staged === 1 ? "change" : "changes"} waiting · nothing is written until you publish.</span> : null}
        {!enabled && disabledReason ? <span className="t-caption normal-case tracking-normal">{disabledReason}</span> : null}
        {error ? <StatusText tone="err" className="text-[12px]">{error}</StatusText> : null}
      </div>
    </div>
  )
}

export { ProfileEditor }
