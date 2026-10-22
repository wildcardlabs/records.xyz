import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { Address, Hex } from "viem"
import { useConnection, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi"
import { dataResolverAbi } from "@/lib/ens/abis"
import type { PublishFlavours } from "@/lib/ens/write"
import { type PublishPlan, buildPublishCalls } from "@/lib/ens/write"
import { asChainId } from "@/lib/wagmi"
import { shortAddr } from "@/lib/format"

/** The four kinds of change a record page publishes, each from its own section. */
export type PublishGroup = "accounts" | "records" | "access" | "links"

/**
 * One wallet flow shared by every publish button on the page: switch chain, send the
 * resolver multicall, follow the receipt, and hand the mined result back to whoever asked.
 * Only one transaction is tracked at a time, so every button waits while one is in flight.
 */
export function usePublisher(name: string | undefined, recordsChainId: number, resolver: Address | null | undefined, flavours: PublishFlavours) {
  const { chainId: walletChainId } = useConnection()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync, isPending: sending } = useWriteContract()
  const [tx, setTx] = useState<{ hash: Hex; group: PublishGroup; onMined: () => void } | null>(null)
  const [signing, setSigning] = useState<PublishGroup | null>(null)
  const receipt = useWaitForTransactionReceipt({ hash: tx?.hash, chainId: asChainId(recordsChainId) })
  const handled = useRef<Hex | null>(null)

  useEffect(() => {
    if (!tx || !receipt.isSuccess || handled.current === tx.hash) return
    handled.current = tx.hash
    tx.onMined()
    toast.success("published", { description: `${shortAddr(tx.hash, 8)} · mined` })
  }, [tx, receipt.isSuccess])

  async function publish(group: PublishGroup, plan: PublishPlan, onMined: () => void) {
    if (!name || !resolver) return
    const calls = buildPublishCalls(name, plan, flavours)
    if (calls.length === 0) return
    setSigning(group)
    try {
      if (walletChainId !== recordsChainId) await switchChainAsync({ chainId: asChainId(recordsChainId) })
      const hash = await writeContractAsync({ address: resolver, abi: dataResolverAbi, functionName: "multicall", args: [calls], chainId: asChainId(recordsChainId) })
      setTx({ hash, group, onMined })
      toast("transaction sent", { description: shortAddr(hash, 8) })
    } catch (e) {
      toast.error("publish failed", { description: (e as Error).message?.split("\n")[0] })
    } finally {
      setSigning(null)
    }
  }

  const mining = !!tx && receipt.isLoading
  return {
    publish,
    sending: signing !== null || sending,
    mining,
    /** true while any group's transaction is being signed or mined */
    busy: signing !== null || sending || mining,
    /** the group being signed, else the one whose transaction is in flight or just mined */
    active: signing ?? tx?.group ?? null,
    txHash: tx?.hash,
    mined: !!tx && receipt.isSuccess,
  }
}
