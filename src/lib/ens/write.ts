import { type Address, type Hex, encodeFunctionData, namehash, toHex } from "viem"
import { packetToBytes } from "viem/ens"
import { dataResolverAbi, nameKeyedMoreAbi, nameKeyedProfileAbi, nameKeyedResolverAbi, nodeKeyedMoreAbi, nodeKeyedProfileAbi } from "./abis"
import { defFromId } from "@/lib/records"
import type { WriteFlavour } from "./capabilities"
import { CHAINS_KEY, encodeChains, encodeListing, encodeProof, listingKey, proofKey } from "@/lib/ensip28"
import { type AccessChange, buildAccessCall } from "./roles"
import { type LinkChange, buildLinkCall } from "./links"

export type PublishPlan = {
  /** final listings per chain after drafts and removals are applied */
  listings: Record<number, Address[]>
  /** new proofs to write */
  proofs: { chainId: number; account: Address; expiresAt: bigint; signature: Hex }[]
  /** accounts whose proof record should be cleared */
  removals: { chainId: number; account: Address }[]
  /** profile records by registry id, in stored form ("" or "0x" clears) */
  records?: Record<string, string>
  /** ENSv2 resolver role grants and revokes */
  access?: AccessChange[]
  /** ENSv2 record links: which record a name reads */
  links?: LinkChange[]
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
  const byName = flavours.profile === "name"
  const setRecord = (id: string, value: string) => {
    const def = defFromId(id)
    if (!def) return
    const bytes = (value && value !== "0x" ? value : "0x") as Hex
    switch (def.kind) {
      case "text":
        calls.push(byName
          ? encodeFunctionData({ abi: nameKeyedProfileAbi, functionName: "setText", args: [dns, def.arg as string, value] })
          : encodeFunctionData({ abi: nodeKeyedProfileAbi, functionName: "setText", args: [node, def.arg as string, value] }))
        break
      case "address":
        calls.push(byName
          ? encodeFunctionData({ abi: nameKeyedProfileAbi, functionName: "setAddress", args: [dns, BigInt(def.arg as number), bytes] })
          : encodeFunctionData({ abi: nodeKeyedProfileAbi, functionName: "setAddr", args: [node, BigInt(def.arg as number), bytes] }))
        break
      case "contenthash":
        calls.push(byName
          ? encodeFunctionData({ abi: nameKeyedMoreAbi, functionName: "setContenthash", args: [dns, bytes] })
          : encodeFunctionData({ abi: nodeKeyedMoreAbi, functionName: "setContenthash", args: [node, bytes] }))
        break
      case "abi":
        calls.push(byName
          ? encodeFunctionData({ abi: nameKeyedMoreAbi, functionName: "setABI", args: [dns, BigInt(def.arg as number), bytes] })
          : encodeFunctionData({ abi: nodeKeyedMoreAbi, functionName: "setABI", args: [node, BigInt(def.arg as number), bytes] }))
        break
      case "interface": {
        const impl = (value && value !== "0x" ? value : "0x0000000000000000000000000000000000000000") as Address
        calls.push(byName
          ? encodeFunctionData({ abi: nameKeyedMoreAbi, functionName: "setInterface", args: [dns, def.arg as Hex, impl] })
          : encodeFunctionData({ abi: nodeKeyedMoreAbi, functionName: "setInterface", args: [node, def.arg as Hex, impl] }))
        break
      }
      case "data":
        set(def.arg as string, bytes)
        break
      case "name":
        break
    }
  }

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
  for (const [id, value] of Object.entries(plan.records ?? {})) setRecord(id, value)
  for (const c of plan.access ?? []) calls.push(buildAccessCall(c))
  // links last: a setter on a freshly detached name would otherwise mint it a new record first
  for (const l of plan.links ?? []) calls.push(buildLinkCall(l))
  return calls
}

export function encodeMulticall(calls: Hex[]): Hex {
  return encodeFunctionData({ abi: dataResolverAbi, functionName: "multicall", args: [calls] })
}
