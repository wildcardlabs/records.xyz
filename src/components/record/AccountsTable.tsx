import { AddressLink } from "@/components/wrap"
import { Copy, ExternalLink } from "lucide-react"
import { cn } from "cn"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { StatusMark, statusSpec, type RowStatus } from "./StatusMark"
import { chainById } from "@/lib/ens/chains"
import { daysUntil, fmtDate } from "@/lib/format"
import type { AccountKind } from "@/hooks/useRecord"

export type Row = {
  chainId: number
  account: `0x${string}`
  kind: AccountKind
  status: RowStatus
  reason: string
  expiresAt?: bigint
  /** present when the row is a local draft or a pending removal */
  pending?: "add" | "remove"
}

const kindLabel: Record<AccountKind, { label: string; hint: string }> = {
  eoa: { label: "wallet", hint: "externally owned account · verified by ecrecover" },
  contract: { label: "smart account", hint: "contract account · verified via ERC-1271" },
  "7702": { label: "delegated wallet", hint: "EIP-7702 delegated EOA · verified via its delegate (ERC-1271)" },
}

function copy(text: string, what: string) {
  navigator.clipboard?.writeText(text)
  toast(`${what} copied`)
}

function AccountsTable({
  rows,
  canEdit,
  onRemove,
  onUndo,
  onRenew,
}: {
  rows: Row[]
  canEdit: boolean
  onRemove?: (r: Row) => void
  onUndo?: (r: Row) => void
  onRenew?: (r: Row) => void
}) {
  return (
    <>
    {/* phones: one card per account */}
    <ul className="divide-y divide-line-soft sm:hidden">
      {rows.map((r) => {
        const chain = chainById(r.chainId)
        const href = chain ? `${chain.explorer}/address/${r.account}` : undefined
        const days = r.expiresAt ? daysUntil(r.expiresAt) : undefined
        return (
          <li key={`${r.chainId}:${r.account}`} className={cn("px-4 py-3", r.pending === "remove" && "opacity-60")}>
            <div className="flex items-center justify-between gap-3">
              <StatusMark status={r.status} />
              <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
                <span className="dot text-blue-2" />
                {chain?.label ?? `chain ${r.chainId}`} · {kindLabel[r.kind].label}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <AddressLink address={r.account} className="text-[13px]" />
              <button type="button" className="link-blue text-ink-dim" aria-label="copy address" onClick={() => copy(r.account, "address")}>
                <Copy className="size-3.5" />
              </button>
              {href ? (
                <a className="link-blue text-ink-dim" href={href} target="_blank" rel="noreferrer" aria-label="open in explorer">
                  <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </div>
            <div className="mt-1 text-[11px] text-ink-dim">
              {r.expiresAt ? (
                <>valid until {fmtDate(r.expiresAt)}{days !== undefined ? ` · ${days > 0 ? `${days} days left` : "past"}` : ""}</>
              ) : (
                <>{r.reason || statusSpec[r.status].short}</>
              )}
            </div>
            {canEdit ? (
              <div className="mt-2.5 flex gap-1.5">
                {r.pending ? (
                  <Button size="sm" variant="outline" onClick={() => onUndo?.(r)}>undo</Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => onRenew?.(r)}>{r.status === "other-name" ? "sign for this name" : "renew"}</Button>
                    <Button size="sm" variant="destructive" onClick={() => onRemove?.(r)}>remove</Button>
                  </>
                )}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
    {/* wider screens: the ledger */}
    <div className="max-sm:hidden">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>status</TableHead>
          <TableHead>wallet</TableHead>
          <TableHead>chain</TableHead>
          <TableHead>type</TableHead>
          <TableHead className="text-right">valid until</TableHead>
          {canEdit ? <TableHead className="text-right"></TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const chain = chainById(r.chainId)
          const href = chain ? `${chain.explorer}/address/${r.account}` : undefined
          const days = r.expiresAt ? daysUntil(r.expiresAt) : undefined
          const kind = kindLabel[r.kind]
          return (
            <TableRow key={`${r.chainId}:${r.account}`} className={r.pending === "remove" ? "opacity-60" : undefined}>
              <TableCell className="py-3">
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <StatusMark status={r.status} />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs font-mono text-[11px] lowercase whitespace-normal">{r.reason || statusSpec[r.status].short}</TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className="py-3">
                <span className="inline-flex items-center gap-1.5">
                  <AddressLink address={r.account} className="text-[12.5px]" />
                  <button type="button" className="link-blue text-ink-dim" aria-label="copy address" onClick={() => copy(r.account, "address")}>
                    <Copy className="size-3.5" />
                  </button>
                  {href ? (
                    <a className="link-blue text-ink-dim" href={href} target="_blank" rel="noreferrer" aria-label="open in explorer">
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : null}
                </span>
              </TableCell>
              <TableCell className="py-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="dot text-blue-2" />
                  {chain?.label ?? `chain ${r.chainId}`}
                </span>
              </TableCell>
              <TableCell className="py-3">
                <Tooltip>
                  <TooltipTrigger render={<span className="text-ink-muted" />}>{kind.label}</TooltipTrigger>
                  <TooltipContent className="font-mono text-[11px] lowercase">{kind.hint}</TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className="py-3 text-right">
                {r.expiresAt ? (
                  <span className={days !== undefined && days <= 30 ? "text-wait" : undefined}>
                    {fmtDate(r.expiresAt)}
                    <span className="text-ink-dim"> · {days !== undefined && days > 0 ? `${days} days` : "past"}</span>
                  </span>
                ) : (
                  <span className="text-ink-dim">—</span>
                )}
              </TableCell>
              {canEdit ? (
                <TableCell className="py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    {r.pending ? (
                      <Button size="sm" variant="outline" onClick={() => onUndo?.(r)}>undo</Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => onRenew?.(r)}>{r.status === "other-name" ? "sign for this name" : "renew"}</Button>
                        <Button size="sm" variant="destructive" onClick={() => onRemove?.(r)}>remove</Button>
                      </>
                    )}
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
    </div>
    </>
  )
}

function AccountsTableSkeleton() {
  return (
    <div className="divide-y divide-line-soft">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-6 px-3 py-3.5">
          <div className="h-5 w-24 bg-wash" />
          <div className="h-4 w-36 bg-wash" />
          <div className="h-4 w-16 bg-wash" />
          <div className="ml-auto h-4 w-28 bg-wash" />
        </div>
      ))}
    </div>
  )
}

export { AccountsTable, AccountsTableSkeleton }
