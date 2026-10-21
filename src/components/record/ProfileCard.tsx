import { useState } from "react"
import { Copy, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FigSplit } from "@/components/wrap"
import type { Profile } from "@/lib/ens/profile"
import { shortAddr } from "@/lib/format"

function Avatar({ src, name }: { src: string | null; name: string }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return (
      <div className="flex size-16 shrink-0 items-center justify-center border border-line bg-paper font-mono text-[20px] font-semibold text-ink-dim">
        {name.slice(0, 1)}
      </div>
    )
  }
  return <img src={src} alt="" width={64} height={64} className="size-16 shrink-0 border border-line bg-paper object-cover" onError={() => setBroken(true)} />
}

function host(u: string) {
  try {
    return new URL(u.startsWith("http") ? u : `https://${u}`).host.replace(/^www\./, "")
  } catch {
    return u
  }
}

/** Read-only profile: avatar, description, links and the name's payment addresses per chain. */
function ProfileCard({ name, profile, loading }: { name: string; profile: Profile | undefined; loading: boolean }) {
  const empty = !loading && profile && !profile.avatar && !profile.description && !profile.url && profile.socials.length === 0 && profile.addresses.length === 0
  return (
    <FigSplit className="sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {loading ? <div className="size-16 shrink-0 bg-wash" /> : <Avatar src={profile?.avatarUrl ?? null} name={name} />}
          <div className="min-w-0">
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
      <div className="min-w-0">
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
  )
}

export { ProfileCard }
