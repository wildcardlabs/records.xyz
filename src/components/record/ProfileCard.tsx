import { useState } from "react"
import { Check, Copy, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { FigSplit } from "@/components/wrap"
import type { Profile } from "@/lib/ens/profile"
import { shortAddr } from "@/lib/format"

function Avatar({ src, name, ring = false }: { src: string | null; name: string; ring?: boolean }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return (
      <div className={cn("flex size-16 shrink-0 items-center justify-center border border-line bg-paper font-mono text-[20px] font-semibold text-ink-dim", ring && "outline outline-4 outline-paper")}>
        {name.slice(0, 1)}
      </div>
    )
  }
  return <img src={src} alt="" width={64} height={64} className={cn("size-16 shrink-0 border border-line bg-paper object-cover", ring && "outline outline-4 outline-paper")} onError={() => setBroken(true)} />
}

/** `header` record as a wide banner; falls back to the `theme` colour, then to nothing. */
function Banner({ src, theme }: { src: string | null; theme: string | null }) {
  const [broken, setBroken] = useState(false)
  const color = theme && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(theme) ? theme : null
  if ((!src || broken) && !color) return null
  return (
    <div className="h-32 w-full overflow-hidden border-b border-line sm:h-40" style={color ? { background: color } : undefined}>
      {src && !broken ? <img src={src} alt="" className="size-full object-cover" onError={() => setBroken(true)} /> : null}
    </div>
  )
}

function host(u: string) {
  try {
    return new URL(u.startsWith("http") ? u : `https://${u}`).host.replace(/^www\./, "")
  } catch {
    return u
  }
}

/** Read-only profile: avatar, description, links and the name's payment addresses per chain. */
/** Small olive check shown on a payment address that also signed a live owned-account consent on its chain. */
function ConsentedMark({ name }: { name: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex size-4 items-center justify-center border border-ok text-ok" aria-label="consented" />}>
        <Check className="size-3" strokeWidth={3} />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs font-mono text-[11px] lowercase whitespace-normal">
        this address signed a consent for {name} on this chain · checked on chain
      </TooltipContent>
    </Tooltip>
  )
}

function ProfileCard({
  name,
  profile,
  loading,
  consented,
}: {
  name: string
  profile: Profile | undefined
  loading: boolean
  /** returns true when the address is a live verified owned account on the chain of this coin type */
  consented?: (coinType: number, address: string) => boolean
}) {
  const empty = !loading && profile && !profile.avatar && !profile.description && !profile.url && profile.socials.length === 0 && profile.addresses.length === 0
  const hasBanner = !!(profile?.header || (profile?.theme && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(profile.theme)))
  return (
    <div>
      {!loading && profile ? <Banner src={profile.header} theme={profile.theme} /> : null}
      <FigSplit className="sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className={cn("p-4 sm:p-5", hasBanner && "-mt-6 sm:-mt-7")}>
          <div className="relative z-10 flex items-start gap-4">
            {loading ? <div className="size-16 shrink-0 bg-wash" /> : <Avatar src={profile?.avatarUrl ?? null} name={name} ring={hasBanner} />}
            <div className={cn("min-w-0", hasBanner && "pt-6 sm:pt-7")}>
              <div className="t-fig-title truncate">{name}</div>
              {loading ? (
                <div className="mt-2 h-3 w-40 bg-wash" />
              ) : profile?.description ? (
                <p className="t-fig-body mt-1">{profile.description}</p>
              ) : (
                <p className="t-fig-body mt-1 text-ink-dim">no description set</p>
              )}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {profile?.url ? (
                  <a className="link-blue" href={profile.url.startsWith("http") ? profile.url : `https://${profile.url}`} target="_blank" rel="noreferrer">
                    <Badge variant="blue">{host(profile.url)}</Badge>
                  </a>
                ) : null}
                {profile?.socials.map((s) =>
                  s.href ? (
                    <a key={s.key} className="link-blue" href={s.href} target="_blank" rel="noreferrer">
                      <Badge>{s.label} · {s.value.replace(/^@/, "")}</Badge>
                    </a>
                  ) : (
                    <Badge key={s.key}>{s.label} · {s.value}</Badge>
                  )
                )}
              </div>
            </div>
          </div>
          {empty ? <p className="t-caption mt-4 normal-case tracking-normal">this name has no profile records yet.</p> : null}
        </div>
        <div className={cn("min-w-0", hasBanner && "sm:border-t sm:border-line")}>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
            <span className="t-label text-ink-dim">payment addresses</span>
            <span className="t-caption normal-case tracking-normal">where to pay {name}</span>
          </div>
          {loading ? (
            <div className="space-y-2 p-4">
              <div className="h-3 w-48 bg-wash" />
              <div className="h-3 w-40 bg-wash" />
            </div>
          ) : profile && profile.addresses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>chain</TableHead>
                  <TableHead>address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profile.addresses.map((a) => (
                  <TableRow key={a.coinType}>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5"><span className="dot text-blue-2" />{a.label}</span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="tabular font-semibold text-ink">{shortAddr(a.address, 6)}</span>
                        {consented?.(a.coinType, a.address) ? <ConsentedMark name={name} /> : null}
                        <button type="button" className="link-blue text-ink-dim" aria-label="copy address" onClick={() => { navigator.clipboard?.writeText(a.address); toast("address copied") }}>
                          <Copy className="size-3.5" />
                        </button>
                        {a.explorer ? (
                          <a className="link-blue text-ink-dim" href={`${a.explorer}/address/${a.address}`} target="_blank" rel="noreferrer" aria-label="open in explorer">
                            <ExternalLink className="size-3.5" />
                          </a>
                        ) : null}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="t-fig-body p-4 text-ink-dim">no payment addresses set.</p>
          )}
        </div>
      </FigSplit>
    </div>
  )
}

export { ProfileCard }
