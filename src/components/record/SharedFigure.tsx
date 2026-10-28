import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LivePill, Pager, usePager } from "@/components/wrap"
import { type LinkChange, ROOT_NAME, type ResolverLink } from "@/lib/ens/links"

/** What a name actually reads: its own record, else the default record, else nothing. */
export function effectiveRecord(row: ResolverLink | undefined, defaultId: string): string {
  if (!row) return defaultId
  return row.recordId !== "0" ? row.recordId : defaultId
}

/**
 * Which names use this name's profile. On ENSv2 several names can read and write one profile;
 * this lists them, lets the owner detach one, and shows whether this profile is the default
 * that names without a profile of their own fall back to.
 */
function SharedFigure({
  name,
  rows,
  indexed,
  loading,
  canLink,
  staged,
  onShare,
  onStage,
}: {
  name: string
  rows: ResolverLink[] | undefined
  indexed: boolean
  loading: boolean
  canLink: boolean
  staged: LinkChange[]
  onShare: () => void
  onStage: (c: LinkChange) => void
}) {
  const list = rows ?? []
  const me = list.find((r) => !r.isDefault && r.name === name)
  const root = list.find((r) => r.isDefault)
  const defaultId = root?.recordId ?? "0"
  const myId = effectiveRecord(me, defaultId)
  const names = list.filter((r) => !r.isDefault)
  const sharing = myId === "0" ? [] : names.filter((r) => effectiveRecord(r, defaultId) === myId).sort((a, b) => (a.name === name ? -1 : b.name === name ? 1 : a.name.localeCompare(b.name)))
  const others = sharing.filter((r) => r.name !== name).length
  const stagedFor = (source: string) => staged.find((s) => s.sourceName === source)
  const pager = usePager(sharing)
  const isDefault = defaultId !== "0" && defaultId === myId

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-5">
        <span className="t-caption normal-case tracking-normal">
          {loading
            ? "reading…"
            : myId === "0"
              ? `${name} has no profile yet`
              : others === 0
                ? `no other name uses ${name}'s profile yet`
                : `${others} other ${others === 1 ? "name uses" : "names use"} ${name}'s profile`}
          {!indexed && !loading ? " · no indexer here" : ""}
        </span>
        <Button size="sm" variant={canLink ? "accent" : "outline"} disabled={!canLink || loading || myId === "0"} onClick={onShare}>+ share with another name</Button>
      </div>
      {loading ? (
        <div className="space-y-2 p-4"><div className="h-3 w-56 bg-wash" /><div className="h-3 w-40 bg-wash" /></div>
      ) : myId === "0" ? (
        <p className="t-fig-body px-4 py-4 text-ink-dim sm:px-5">publish a profile first, then other names can use it.</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {pager.slice.map((r) => {
            const isMe = r.name === name
            const viaDefault = r.recordId === "0"
            const pending = stagedFor(r.name)
            return (
              <li key={r.node} className={`flex flex-wrap items-center gap-3 px-4 py-2.5 text-[12px] sm:px-5 ${pending ? "opacity-60" : ""}`}>
                {isMe ? <span className="font-semibold text-ink">{r.name}</span> : <Link className="link-blue font-semibold text-ink" to={`/${r.name}`}>{r.name}</Link>}
                {isMe ? <LivePill pulse={false}>this name</LivePill> : null}
                {viaDefault ? <Badge variant="outline">via the default</Badge> : null}
                {canLink ? (
                  <span className="ml-auto">
                    {pending ? (
                      <span className="text-[11px] text-blue">change staged</span>
                    ) : isMe && others > 0 && !viaDefault ? (
                      <Button size="sm" variant="ghost" onClick={() => onStage({ sourceName: name, recordId: "0", scope: defaultId !== "0" && !isDefault ? `${name} leaves this profile · uses the default` : `${name} leaves this profile · starts blank` })}>
                        leave
                      </Button>
                    ) : !isMe && !viaDefault ? (
                      <Button size="sm" variant="ghost" onClick={() => onStage({ sourceName: r.name, recordId: "0", scope: defaultId !== "0" && !isDefault ? `${r.name} stops using ${name}'s profile · uses the default` : `${r.name} stops using ${name}'s profile · starts blank` })}>
                        detach
                      </Button>
                    ) : null}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      <Pager page={pager.page} pages={pager.pages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
      {!loading ? (
        <div className={`flex flex-wrap items-center gap-3 border-t border-line px-4 py-2.5 text-[12px] sm:px-5 ${stagedFor(ROOT_NAME) ? "opacity-60" : ""}`}>
          <span className="text-ink-muted">
            default for names without a profile:{" "}
            <span className="font-semibold text-ink">{defaultId === "0" ? "none" : isDefault ? `${name}'s` : "another name's profile"}</span>
          </span>
          {canLink ? (
            <span className="ml-auto">
              {stagedFor(ROOT_NAME) ? (
                <span className="text-[11px] text-blue">change staged</span>
              ) : myId !== "0" && !isDefault ? (
                <Button size="sm" variant="outline" onClick={() => onStage({ sourceName: ROOT_NAME, recordId: myId, scope: `names without a profile use ${name}'s` })}>
                  make this the default
                </Button>
              ) : isDefault ? (
                <Button size="sm" variant="ghost" onClick={() => onStage({ sourceName: ROOT_NAME, recordId: "0", scope: "default profile cleared" })}>
                  clear
                </Button>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export { SharedFigure }
