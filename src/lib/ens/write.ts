import { type Address, type Hex, encodeFunctionData, namehash, toHex } from "viem"
import { packetToBytes } from "viem/ens"
import { dataResolverAbi, nameKeyedProfileAbi, nameKeyedResolverAbi, nodeKeyedProfileAbi } from "./abis"
import type { WriteFlavour } from "./capabilities"
import { CHAINS_KEY, encodeChains, encodeListing, encodeProof, listingKey, proofKey } from "@/lib/ensip28"

export type PublishPlan = {
  /** final listings per chain after drafts and removals are applied */
  listings: Record<number, Address[]>
  /** new proofs to write */
  proofs: { chainId: number; account: Address; expiresAt: bigint; signature: Hex }[]
  /** accounts whose proof record should be cleared */
  removals: { chainId: number; account: Address }[]
  /** text records to set; an empty string clears the key */
  texts?: Record<string, string>
  /** address records by coin type; an empty string clears the record */
  addrs?: Record<number, Address | "">
}

export type PublishFlavours = { data: WriteFlavour; profile: WriteFlavour }

/**
 * Build the `multicall(bytes[])` calldata list that publishes a plan to the resolver.
 * `flavour` picks the setter: v1-style `setData(bytes32 node, …)` or the ENSv2
 * PermissionedResolver's `setData(bytes name, …)` keyed by the DNS-encoded name.
 */
export function buildPublishCalls(name: string, plan: PublishPlan, flavour: WriteFlavour | PublishFlavours = "node"): Hex[] {
  const flavours: PublishFlavours = typeof flavour === "string" ? { data: flavour, profile: flavour } : flavour
  const node = namehash(name)
  const dns = toHex(packetToBytes(name))
  const calls: Hex[] = []
  const set = (key: string, value: Hex) =>
    calls.push(
      flavours.data === "name"
        ? encodeFunctionData({ abi: nameKeyedResolverAbi, functionName: "setData", args: [dns, key, value] })
        : encodeFunctionData({ abi: dataResolverAbi, functionName: "setData", args: [node, key, value] })
    )
  const setText = (key: string, value: string) =>
    calls.push(
      flavours.profile === "name"
        ? encodeFunctionData({ abi: nameKeyedProfileAbi, functionName: "setText", args: [dns, key, value] })
        : encodeFunctionData({ abi: nodeKeyedProfileAbi, functionName: "setText", args: [node, key, value] })
    )
  const setAddr = (coinType: number, address: Address | "") =>
    calls.push(
      flavours.profile === "name"
        ? encodeFunctionData({ abi: nameKeyedProfileAbi, functionName: "setAddress", args: [dns, BigInt(coinType), address === "" ? "0x" : address] })
        : encodeFunctionData({ abi: nodeKeyedProfileAbi, functionName: "setAddr", args: [node, BigInt(coinType), address === "" ? "0x" : address] })
    )

  // owned accounts (ENSIP-28), only when the plan touches them
  const touchesData = Object.keys(plan.listings).length > 0 || plan.proofs.length > 0 || plan.removals.length > 0
  if (touchesData) {
    const chainIds = Object.keys(plan.listings).map(Number).sort((a, b) => a - b)
    for (const chainId of chainIds) set(listingKey(chainId), encodeListing(plan.listings[chainId]))
    for (const p of plan.proofs) set(proofKey(p.chainId, p.account), encodeProof(p.expiresAt, p.signature))
    for (const r of plan.removals) set(proofKey(r.chainId, r.account), "0x")
    set(CHAINS_KEY, encodeChains(chainIds.filter((c) => plan.listings[c].length > 0)))
  }
  // profile records
  for (const [key, value] of Object.entries(plan.texts ?? {})) setText(key, value)
  for (const [ct, address] of Object.entries(plan.addrs ?? {})) setAddr(Number(ct), address)
  return calls
}

export function encodeMulticall(calls: Hex[]): Hex {
  return encodeFunctionData({ abi: dataResolverAbi, functionName: "multicall", args: [calls] })
}
