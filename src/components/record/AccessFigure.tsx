import { AddressLink } from "@/components/wrap"
import { useMemo } from "react"
import type { Address } from "viem"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { LivePill } from "@/components/wrap"
import { addressLabel } from "@/lib/ens/profile"
import { TEXT_SPECS, listCoins } from "@/lib/records"
import type { BigNameRoleRow } from "@/lib/ens/bigname"
import { type AccessChange, type Power, POWER_LABEL, ROLE, adminOf, coinResource, keyResource, powersFromBigName } from "@/lib/ens/roles"

/** Label a resource id by matching it against the keys and chains the app knows. */
function useResourceLabels(recordsChainId: number, extraKeys: string[]) {
  return useMemo(() => {
    const m = new Map<string, string>()
    m.set("0", "all keys")
    for (const f of TEXT_SPECS) m.set(keyResource(f.key).toString(), `key ${f.key}`)
    for (const k of extraKeys) m.set(keyResource(k).toString(), `key ${k}`)
    for (const c of listCoins()) m.set(coinResource(c.coinType).toString(), `${addressLabel(c.coinType, recordsChainId).label} address`)
    m.set(keyResource("accounts-chains").toString(), "key accounts-chains")
    return m
  }, [recordsChainId, extraKeys])
}

const SHOWN: Power[] = ["text", "address", "data", "contenthash", "name", "link", "upgrade", "canName", "abi", "interface"]

/**
 * Who can edit records on the name's ENSv2 resolver. Rows come from BigName; the owner can stage
 * revokes here and grants through the dialog. Roles are per resolver, not per name.
 */
function AccessFigure({
  recordsChainId,
  rows,
  loading,
  indexed,
  connected,
  canAdmin,
  staged,
  extraKeys,
  onGrant,
  onRevoke,
}: {
  recordsChainId: number
  rows: BigNameRoleRow[] | null | undefined
  loading: boolean
  indexed: boolean
  connected: Address | undefined
  canAdmin: boolean
  staged: AccessChange[]
  extraKeys: string[]
  onGrant: () => void
  onRevoke: (c: AccessChange) => void
}) {
  const labels = useResourceLabels(recordsChainId, extraKeys)
  const list = (rows ?? []).filter((r) => r.powers.length > 0)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-5">
        <span className="t-caption normal-case tracking-normal">
          {loading ? "reading…" : `${list.length} ${list.length === 1 ? "wallet" : "wallets"} may edit`}
        </span>
        <Button size="sm" variant={canAdmin ? "accent" : "outline"} disabled={!canAdmin} onClick={onGrant}>+ allow a wallet</Button>
      </div>
      {!indexed ? (
        <p className="t-fig-body p-4 text-ink-dim sm:p-5">no indexer on this network · grants and revokes still work.</p>
      ) : loading ? (
        <div className="space-y-2 p-4"><div className="h-3 w-56 bg-wash" /><div className="h-3 w-40 bg-wash" /></div>
      ) : list.length === 0 ? (
        <p className="t-fig-body p-4 text-ink-dim sm:p-5">no other wallet can edit yet.</p>
      ) : (
        <Table stack>
          <TableHeader>
            <TableRow>
              <TableHead>wallet</TableHead>
              <TableHead>scope</TableHead>
              <TableHead>may change</TableHead>
              {canAdmin ? <TableHead className="text-right"></TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((r) => {
              const { powers, admin } = powersFromBigName(r.powers)
              const isYou = connected && r.address.toLowerCase() === connected.toLowerCase()
              const pendingRevoke = staged.some((s) => s.revoke && s.account.toLowerCase() === r.address.toLowerCase() && s.resource === r.resource)
              const scopeLabel = labels.get(r.resource) ?? `resource ${r.resource.slice(0, 6)}…`
              let bits = 0n
              for (const p of powers) bits |= ROLE[p]
              for (const p of admin) bits |= adminOf(ROLE[p])
              return (
                <TableRow key={`${r.address}:${r.resource}`} className={pendingRevoke ? "opacity-60" : undefined}>
                  <TableCell data-label="wallet">
                    <span className="inline-flex items-center gap-2">
                      <AddressLink address={r.address} />
                      {isYou ? <LivePill pulse={false}>you</LivePill> : null}
                    </span>
                  </TableCell>
                  <TableCell data-label="scope">{scopeLabel}</TableCell>
                  <TableCell data-label="may change" className="whitespace-normal">
                    <span className="flex flex-wrap gap-1">
                      {SHOWN.filter((p) => powers.includes(p)).map((p) => (
                        <Tooltip key={p}>
                          <TooltipTrigger render={<span />}>
                            <Badge variant={admin.includes(p) ? "blue" : "outline"}>{POWER_LABEL[p]}</Badge>
                          </TooltipTrigger>
                          <TooltipContent className="font-mono text-[11px] lowercase">{admin.includes(p) ? "may change and may delegate" : "may change"}</TooltipContent>
                        </Tooltip>
                      ))}
                      {admin.filter((p) => !powers.includes(p)).map((p) => (
                        <Badge key={`a-${p}`} variant="blue">delegate {POWER_LABEL[p]}</Badge>
                      ))}
                    </span>
                  </TableCell>
                  {canAdmin ? (
                    <TableCell className="text-right">
                      {pendingRevoke ? (
                        <span className="text-[11px] text-err">revoke staged</span>
                      ) : isYou ? null : (
                        <Button size="sm" variant="destructive" onClick={() => onRevoke({ account: r.address, resource: r.resource, roleBitmap: bits.toString(), revoke: true, scope: `${scopeLabel} · everything listed` })}>
                          revoke
                        </Button>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

export { AccessFigure }
