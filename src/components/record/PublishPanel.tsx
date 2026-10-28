import { AddressLink } from "@/components/wrap"
import { Button } from "@/components/ui/button"
import { StatusText } from "@/components/wrap"
import { StatusMark } from "./StatusMark"
import { shortAddr } from "@/lib/format"

export type PendingRow = {
  key: string
  status: "draft" | "removing"
  label: string
  /** when the label is a wallet, link it to that wallet's names */
  address?: string
  detail: string
  /** red note after the detail */
  warn?: string
  tabular?: boolean
  onDiscard: () => void
}

/** Rows waiting to be published, with a discard per row. */
function PendingRows({ rows, onDiscardAll }: { rows: PendingRow[]; onDiscardAll?: () => void }) {
  if (rows.length === 0) return null
  return (
    <div>
      <div className="t-label px-5 py-2 text-ink-dim">waiting to be published</div>
      <ul className="divide-y divide-line-soft border-t border-line-soft px-5 text-[12px]">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-wrap items-center gap-3 py-2.5">
            <StatusMark status={r.status} />
            {r.address ? <AddressLink address={r.address} /> : <span className="font-semibold">{r.label}</span>}
            <span className={`min-w-0 flex-1 truncate text-ink-dim ${r.tabular ? "tabular" : ""}`}>
              {r.detail}
              {r.warn ? <span className="text-err"> · {r.warn}</span> : null}
            </span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={r.onDiscard}>discard</Button>
          </li>
        ))}
      </ul>
      {onDiscardAll && rows.length > 1 ? (
        <div className="flex items-center justify-end border-t border-line-soft px-5 py-2">
          <Button size="sm" variant="ghost" onClick={onDiscardAll}>discard all</Button>
        </div>
      ) : null}
    </div>
  )
}

export type PublishState = {
  /** this group's transaction is being signed */
  sending: boolean
  /** this group's transaction is mining */
  mining: boolean
  /** another group's transaction is in flight */
  blocked: boolean
  txHash?: `0x${string}`
  mined: boolean
}

/**
 * The publish button for one group of changes: what it writes, whether the connected
 * wallet may write it, and the state of the transaction once sent.
 */
function PublishButton({
  count,
  what,
  canPublish,
  checking,
  capable,
  incapableReason,
  explorer,
  state,
  onPublish,
}: {
  count: number
  /** noun for the button, e.g. "record change" */
  what: string
  canPublish: boolean
  /** the permission check is still running */
  checking: boolean
  /** the resolver can take this kind of write at all */
  capable: boolean
  incapableReason?: string
  explorer: string
  state: PublishState
  onPublish: () => void
}) {
  const plural = count === 1 ? what : `${what}s`
  const label = state.sending ? "confirm in wallet…" : state.mining ? "mining…" : count > 0 ? `publish ${count} ${plural}` : "publish"
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant={count > 0 && canPublish ? "accent" : "outline"} disabled={count === 0 || !canPublish || !capable || state.sending || state.mining || state.blocked} onClick={onPublish}>
        {label}
      </Button>
      {count > 0 && !capable ? (
        <span className="t-caption normal-case tracking-normal">{incapableReason ?? "this name's resolver can't be edited here."}</span>
      ) : count > 0 && !canPublish && !checking ? (
        <span className="t-caption normal-case tracking-normal">connect the owner's wallet to publish.</span>
      ) : count > 0 && checking ? (
        <span className="t-caption normal-case tracking-normal">checking permissions…</span>
      ) : state.blocked ? (
        <span className="t-caption normal-case tracking-normal">wait for the other transaction to finish.</span>
      ) : null}
      {state.txHash ? (
        <span className="text-[11px]">
          {state.mined ? <StatusText tone="ok">published</StatusText> : state.mining ? <StatusText tone="wait">mining</StatusText> : <StatusText tone="dim">sent</StatusText>}{" "}
          <a className="link-blue text-ink-dim" href={`${explorer}/tx/${state.txHash}`} target="_blank" rel="noreferrer">{shortAddr(state.txHash, 6)}</a>
        </span>
      ) : null}
    </div>
  )
}

/** Pending rows plus the publish button, as one block at the foot of a figure. */
function PublishPanel(props: Parameters<typeof PublishButton>[0] & { rows: PendingRow[]; onDiscardAll?: () => void; note?: string }) {
  const { rows, onDiscardAll, note, ...button } = props
  if (rows.length === 0 && !button.state.txHash) return null
  return (
    <div className="border-t border-line">
      <PendingRows rows={rows} onDiscardAll={onDiscardAll} />
      <div className="flex flex-wrap items-center gap-3 border-t border-line-soft px-5 py-3">
        <PublishButton {...button} />
        {note ? <span className="t-caption normal-case tracking-normal">{note}</span> : null}
      </div>
    </div>
  )
}

export { PendingRows, PublishButton, PublishPanel }
