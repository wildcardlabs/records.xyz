import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { Address, Hex } from "viem"
import { useConnection, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusText } from "@/components/wrap"
import { primaryQueryKey, usePrimaryNames } from "@/hooks/usePrimaryNames"
import { type PrimaryTarget, reverseRegistrarAbi } from "@/lib/ens/primary"
import { shortAddr } from "@/lib/format"
import { asChainId } from "@/lib/wagmi"

/**
 * Make this name the connected wallet's primary name, per chain. Each row is one reverse
 * registrar: the default that every EVM chain falls back to, the home chain's own, and the
 * L2s. Each write is its own transaction on that chain, sent straight from the wallet.
 */
function PrimaryDialog({ open, onOpenChange, name, recordsChainId }: { open: boolean; onOpenChange: (o: boolean) => void; name: string; recordsChainId: number }) {
  const { address, chainId: walletChainId } = useConnection()
  const rows = usePrimaryNames(address, recordsChainId)
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync, isPending: sending } = useWriteContract()
  const [tx, setTx] = useState<{ hash: Hex; target: PrimaryTarget } | null>(null)
  const [signing, setSigning] = useState<PrimaryTarget | null>(null)
  const receipt = useWaitForTransactionReceipt({ hash: tx?.hash, chainId: tx ? asChainId(tx.target.chain.id) : undefined })
  const qc = useQueryClient()

  useEffect(() => {
    if (!tx || !receipt.isSuccess) return
    qc.invalidateQueries({ queryKey: primaryQueryKey(recordsChainId, address) })
    toast.success(`primary name set on ${tx.target.label}`, { description: shortAddr(tx.hash, 8) })
  }, [tx, receipt.isSuccess, qc, recordsChainId, address])

  async function set(target: PrimaryTarget) {
    if (!address) return
    setSigning(target)
    try {
      if (walletChainId !== target.chain.id) await switchChainAsync({ chainId: asChainId(target.chain.id) })
      const hash = await writeContractAsync({ address: target.registrar, abi: reverseRegistrarAbi, functionName: "setName", args: [name], chainId: asChainId(target.chain.id) })
      setTx({ hash, target })
      toast("transaction sent", { description: `${target.label} · ${shortAddr(hash, 8)}` })
    } catch (e) {
      toast.error("could not set primary name", { description: (e as Error).message?.split("\n")[0]?.slice(0, 140) })
    } finally {
      setSigning(null)
    }
  }

  const busy = !!signing || sending || (!!tx && receipt.isLoading)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="font-mono sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="t-h3 lowercase">Make {name} your primary name</DialogTitle>
          <DialogDescription className="t-body">
            A primary name is what apps show for your wallet {address ? shortAddr(address as Address, 4) : ""}. Set it once for every EVM chain, or per chain. Each row is one transaction, sent on that chain.
          </DialogDescription>
        </DialogHeader>
        {rows.isLoading ? (
          <div className="space-y-2 py-2"><div className="h-3 w-56 bg-wash" /><div className="h-3 w-40 bg-wash" /></div>
        ) : rows.isError ? (
          <div className="py-2 text-[12px]"><StatusText tone="err">could not read primary names.</StatusText> <button type="button" className="link-blue text-ink" onClick={() => rows.refetch()}>try again</button></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>chain</TableHead>
                <TableHead>primary name now</TableHead>
                <TableHead className="w-40 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.data?.map((r) => {
                const isThis = r.name === name && !r.viaDefault
                const thisViaDefault = r.name === name && r.viaDefault
                const inFlight = tx && tx.target.chain.id === r.target.chain.id && tx.target.kind === r.target.kind
                return (
                  <TableRow key={`${r.target.kind}:${r.target.chain.id}`}>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5"><span className={`dot ${r.target.kind === "default" ? "text-blue" : "text-blue-2"}`} />{r.target.label}</span>
                      {r.target.kind === "default" ? <span className="t-caption block normal-case tracking-normal">default · chains without their own fall back to it</span> : null}
                    </TableCell>
                    <TableCell>
                      {r.name ? (
                        <span className="inline-flex items-center gap-2">
                          <span className={r.name === name ? "font-semibold text-ink" : undefined}>{r.name}</span>
                          {isThis ? <Badge variant="ok">this name</Badge> : thisViaDefault ? <Badge variant="outline">via default</Badge> : r.viaDefault ? <Badge variant="outline">via default</Badge> : null}
                        </span>
                      ) : (
                        <span className="text-ink-dim">none</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {inFlight ? (
                        <span className="text-[11px]">
                          {receipt.isSuccess ? <StatusText tone="ok">set</StatusText> : <StatusText tone="wait">mining</StatusText>}{" "}
                          <a className="link-blue text-ink-dim" href={`${r.target.explorer}/tx/${tx!.hash}`} target="_blank" rel="noreferrer">{shortAddr(tx!.hash, 6)}</a>
                        </span>
                      ) : isThis ? null : (
                        <Button size="sm" variant={r.target.kind === "default" ? "accent" : "outline"} disabled={busy} onClick={() => set(r.target)}>
                          {signing?.chain.id === r.target.chain.id && signing.kind === r.target.kind ? "confirm in wallet…" : r.target.kind === "default" ? "set everywhere" : "set here"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        <p className="t-caption normal-case tracking-normal">
          a chain's own entry beats the default. the name must resolve back to your wallet on that chain, or apps will not show it.
        </p>
      </DialogContent>
    </Dialog>
  )
}

export { PrimaryDialog }
