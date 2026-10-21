import { type Address, type Hex, encodeFunctionData, namehash } from "viem"
import { dataResolverAbi } from "./abis"
import { CHAINS_KEY, encodeChains, encodeListing, encodeProof, listingKey, proofKey } from "@/lib/ensip28"

export type PublishPlan = {
  /** final listings per chain after drafts and removals are applied */
  listings: Record<number, Address[]>
  /** new proofs to write */
  proofs: { chainId: number; account: Address; expiresAt: bigint; signature: Hex }[]
  /** accounts whose proof record should be cleared */
  removals: { chainId: number; account: Address }[]
}

/** Build the `multicall(bytes[])` calldata list that publishes a plan to the resolver. */
export function buildPublishCalls(name: string, plan: PublishPlan): Hex[] {
  const node = namehash(name)
  const calls: Hex[] = []
  const set = (key: string, value: Hex) =>
    calls.push(encodeFunctionData({ abi: dataResolverAbi, functionName: "setData", args: [node, key, value] }))

  const chainIds = Object.keys(plan.listings).map(Number).sort((a, b) => a - b)
  for (const chainId of chainIds) set(listingKey(chainId), encodeListing(plan.listings[chainId]))
  for (const p of plan.proofs) set(proofKey(p.chainId, p.account), encodeProof(p.expiresAt, p.signature))
  for (const r of plan.removals) set(proofKey(r.chainId, r.account), "0x")
  set(CHAINS_KEY, encodeChains(chainIds.filter((c) => plan.listings[c].length > 0)))
  return calls
}

export function encodeMulticall(calls: Hex[]): Hex {
  return encodeFunctionData({ abi: dataResolverAbi, functionName: "multicall", args: [calls] })
}
