import { type Address, type Hex, type PublicClient, getAddress, isAddressEqual, zeroAddress } from "viem"
import { DATA_INTERFACE_ID, SELECTORS, SELECTOR_SET_DATA_NAME, dataResolverAbi } from "./abis"
import { readDataRecord } from "./resolve"

export type WriteFlavour = "node" | "name"

export type ResolverCapabilities = {
  /** `data(node,key)` resolves through the Universal Resolver (ENSIP-24 reads work) */
  readsData: boolean
  /** ERC-165 answer for the ENSIP-24 profile (informational; several live builds omit it) */
  erc165Data: boolean
  /** which setData the resolver exposes, or null when records cannot be written on chain */
  writeFlavour: WriteFlavour | null
  multicall: boolean
  /** ENSv2 PermissionedResolver role queries (`hasRoles`) */
  roles: boolean
  /** ENSv2 PublicResolverV2 `canModifyName` */
  canModifyName: boolean
  /** the contracts whose code was inspected: the resolver, then each proxy target */
  inspected: Address[]
}

const ERC1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const
const CLONE_PREFIX = "363d3d373d3d3d363d73"
const CLONE_SUFFIX = "5af43d82803e903d91602b57fd5bf3"

/** Follow EIP-1167 clones and ERC-1967 proxies to the code that actually runs. */
async function collectCode(client: PublicClient, address: Address, depth = 0, seen: Address[] = []): Promise<{ codes: Hex[]; inspected: Address[] }> {
  if (depth > 3 || seen.some((s) => isAddressEqual(s, address))) return { codes: [], inspected: [] }
  seen.push(address)
  let code: Hex = "0x"
  try {
    code = (await client.getCode({ address })) ?? "0x"
  } catch {
    return { codes: [], inspected: [address] }
  }
  const codes: Hex[] = [code]
  const inspected: Address[] = [address]
  const lower = code.toLowerCase()

  // ERC-1967: the implementation pointer lives in the proxy's storage
  try {
    const slot = await client.getStorageAt({ address, slot: ERC1967_IMPL_SLOT })
    if (slot && slot !== "0x" && BigInt(slot) !== 0n) {
      const impl = getAddress(`0x${slot.slice(-40)}`)
      if (!isAddressEqual(impl, zeroAddress)) {
        const r = await collectCode(client, impl, depth + 1, seen)
        codes.push(...r.codes)
        inspected.push(...r.inspected)
      }
    }
  } catch {
    /* no storage access: fall through */
  }

  // EIP-1167 minimal clone: 363d3d373d3d3d363d73 <20-byte target> 5af43d82803e903d91602b57fd5bf3
  const i = lower.indexOf(CLONE_PREFIX)
  if (i >= 0 && lower.slice(i + CLONE_PREFIX.length + 40).startsWith(CLONE_SUFFIX)) {
    const target = getAddress(`0x${lower.slice(i + CLONE_PREFIX.length, i + CLONE_PREFIX.length + 40)}`)
    const r = await collectCode(client, target, depth + 1, seen)
    codes.push(...r.codes)
    inspected.push(...r.inspected)
  }
  return { codes, inspected }
}

/**
 * What a deployed resolver can do for ENSIP-28.
 * Reads are probed for real through the Universal Resolver: a resolver that answers
 * `data()` (even with an empty value) supports the profile; one that reverts with
 * UnsupportedResolverProfile does not. Writes are detected from the proxy-resolved
 * bytecode, because ERC-165 lists lag the deployed builds.
 */
export async function resolverCapabilities(client: PublicClient, name: string, resolver: Address): Promise<ResolverCapabilities> {
  const [erc165Data, readsData, { codes, inspected }] = await Promise.all([
    client.readContract({ address: resolver, abi: dataResolverAbi, functionName: "supportsInterface", args: [DATA_INTERFACE_ID] }).catch(() => false),
    readDataRecord(client, name, "accounts-chains").then(() => true).catch(() => false),
    collectCode(client, resolver),
  ])
  const blob = codes.join("").toLowerCase()
  const has = (sel: string) => blob.includes(sel)
  const writeFlavour: WriteFlavour | null = has(SELECTOR_SET_DATA_NAME) ? "name" : has(SELECTORS.setData) ? "node" : null
  return {
    readsData: readsData || erc165Data,
    erc165Data,
    writeFlavour,
    multicall: has(SELECTORS.multicall),
    roles: has(SELECTORS.hasRoles),
    canModifyName: has(SELECTORS.canModifyName),
    inspected,
  }
}

/** True when ENSIP-28 records can be both read and written on this resolver. */
export const supportsOwnedAccounts = (c: ResolverCapabilities) => c.readsData && c.writeFlavour !== null
