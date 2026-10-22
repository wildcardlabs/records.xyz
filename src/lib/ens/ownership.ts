import { type Address, type PublicClient, isAddressEqual, keccak256, namehash, toBytes, zeroAddress } from "viem"
import { ENS_REGISTRY, KIND_ROLE_BITS, NAME_WRAPPER, nameWrapperAbi, permissionedResolverAbi, registryAbi } from "./abis"
import type { ResolverCapabilities } from "./capabilities"
import { fetchBigName, hasBigName } from "./bigname"
import { CHAINS_KEY } from "@/lib/ensip28"

export type NameOwnership = {
  owner: Address | null
  /** where the answer came from; ENSv2-only names have no v1 owner */
  source: "bigname" | "v1" | "v1-wrapped" | null
  /** ENSv2 manager (BigName), when different from the owner */
  manager?: Address | null
}

/** v1 registry owner, unwrapped through the NameWrapper. ENSv2 ownership is not exposed by the live Universal Resolver yet. */
export async function getNameOwner(client: PublicClient, name: string): Promise<NameOwnership> {
  if (hasBigName(client.chain!.id)) {
    try {
      const bn = await fetchBigName(client.chain!.id, name)
      if (bn?.owner) return { owner: bn.owner, source: "bigname", manager: bn.manager }
    } catch {
      /* indexer unavailable: fall back to the v1 registry */
    }
  }
  const node = namehash(name)
  let owner: Address
  try {
    owner = await client.readContract({ address: ENS_REGISTRY, abi: registryAbi, functionName: "owner", args: [node] })
  } catch {
    return { owner: null, source: null }
  }
  if (isAddressEqual(owner, zeroAddress)) return { owner: null, source: null }
  const wrapper = NAME_WRAPPER[client.chain!.id]
  if (wrapper && isAddressEqual(owner, wrapper)) {
    try {
      const real = await client.readContract({ address: wrapper, abi: nameWrapperAbi, functionName: "ownerOf", args: [BigInt(node)] })
      return { owner: isAddressEqual(real, zeroAddress) ? null : real, source: "v1-wrapped" }
    } catch {
      return { owner: null, source: "v1-wrapped" }
    }
  }
  return { owner, source: "v1" }
}

export type PublishAuthority = { canPublish: boolean; via: "roles" | "canModifyName" | "owner" | "none" }
export type PublishNeeds = { data?: boolean; text?: boolean; addr?: boolean; contenthash?: boolean; abi?: boolean; interface?: boolean; /** staged record links need ROLE_LINK on root */ link?: boolean; /** admin bitmap required for staged access changes (decimal) */ adminBits?: string }

/**
 * Whether `account` can write ENSIP-28 data records for `name` on its resolver.
 * ENSv2 PermissionedResolver: ROLE_SET_DATA on the root resource (any key) or on
 * the key's own resource. ENSv2 PublicResolverV2: `canModifyName`. v1: ownership.
 */
export async function getPublishAuthority(
  client: PublicClient,
  name: string,
  resolver: Address,
  caps: ResolverCapabilities,
  account: Address,
  owner: Address | null,
  manager: Address | null = null,
  needs: PublishNeeds = { data: true }
): Promise<PublishAuthority> {
  const node = namehash(name)
  if (caps.roles) {
    try {
      const root = (bit: bigint) =>
        client.readContract({ address: resolver, abi: permissionedResolverAbi, functionName: "hasRootRoles", args: [bit, account] }).catch(() => false)
      const keyed = (resource: bigint, bit: bigint) =>
        client.readContract({ address: resolver, abi: permissionedResolverAbi, functionName: "hasRoles", args: [resource, bit, account] }).catch(() => false)
      const kindMap = { data: "data", text: "text", addr: "address", contenthash: "contenthash", abi: "abi", interface: "interface", link: "link" } as const
      const kinds = (Object.keys(kindMap) as (keyof typeof kindMap)[]).filter((k) => needs[k]).map((k) => kindMap[k])
      const adminBits = needs.adminBits ? BigInt(needs.adminBits) : 0n
      if (kinds.length === 0 && adminBits === 0n) return { canPublish: false, via: "roles" }
      if (adminBits !== 0n) {
        const okAdmin = await root(adminBits)
        if (!okAdmin) return { canPublish: false, via: "roles" }
        if (kinds.length === 0) return { canPublish: true, via: "roles" }
      }
      const perKind = await Promise.all(
        kinds.map(async (kind) => {
          const bits = KIND_ROLE_BITS[kind]
          const checks = await Promise.all(
            bits.flatMap((bit) => (kind === "data" ? [root(bit), keyed(BigInt(keccak256(toBytes(CHAINS_KEY))), bit)] : [root(bit)]))
          )
          return checks.some(Boolean)
        })
      )
      return { canPublish: perKind.every(Boolean), via: "roles" }
    } catch {
      /* fall through */
    }
  }
  if (caps.canModifyName) {
    try {
      const ok = await client.readContract({ address: resolver, abi: permissionedResolverAbi, functionName: "canModifyName", args: [node, account] })
      return { canPublish: ok, via: "canModifyName" }
    } catch {
      /* fall through */
    }
  }
  if (owner && isAddressEqual(owner, account)) return { canPublish: true, via: "owner" }
  if (manager && isAddressEqual(manager, account)) return { canPublish: true, via: "owner" }
  return { canPublish: false, via: "none" }
}
