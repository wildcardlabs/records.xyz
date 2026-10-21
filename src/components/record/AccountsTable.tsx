import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { StatusBadge, type RowStatus } from "./StatusBadge"
import { chainById } from "@/lib/ens/chains"
import { daysUntil, fmtDate, shortAddr } from "@/lib/format"
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

const kindLabel: Record<AccountKind, string> = { eoa: "eoa", contract: "contract", "7702": "7702" }

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
  if (rows.length === 0) {
    return <div className="t-body px-5 py-8 text-center">nothing on the record yet.</div>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>chain</TableHead>
          <TableHead>account</TableHead>
          <TableHead>type</TableHead>
          <TableHead>status</TableHead>
          <TableHead className="text-right">expires</TableHead>
          {canEdit ? <TableHead className="text-right">actions</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const chain = chainById(r.chainId)
          const href = chain ? `${chain.explorer}/address/${r.account}` : undefined
          const days = r.expiresAt ? daysUntil(r.expiresAt) : undefined
          return (
            <TableRow key={`${r.chainId}:${r.account}`} className={r.pending === "remove" ? "opacity-60" : undefined}>
              <TableCell>{chain?.label ?? r.chainId}</TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger render={<a className="link-blue tabular" href={href} target="_blank" rel="noreferrer" />}>
                    {shortAddr(r.account, 6)}
                  </TooltipTrigger>
                  <TooltipContent className="font-mono text-[11px]">{r.account}</TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Badge variant="dim">{kindLabel[r.kind]}</Badge>
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <StatusBadge status={r.status} />
                  </TooltipTrigger>
                  <TooltipContent className="font-mono text-[11px] lowercase">{r.reason}</TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className="text-right">
                {r.expiresAt ? (
                  <span className={days !== undefined && days <= 30 ? "text-wait" : undefined}>
                    {fmtDate(r.expiresAt)}
                    {days !== undefined ? <span className="text-ink-dim"> · {days > 0 ? `${days}d` : "past"}</span> : null}
                  </span>
                ) : (
                  <span className="text-ink-dim">—</span>
                )}
              </TableCell>
              {canEdit ? (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    {r.pending ? (
                      <Button size="sm" variant="outline" onClick={() => onUndo?.(r)}>undo</Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => onRenew?.(r)}>renew</Button>
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
  )
}

export { AccountsTable }
