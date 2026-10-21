import { type Address, type PublicClient, isAddressEqual, namehash, zeroAddress } from "viem"
import { ENS_REGISTRY, NAME_WRAPPER, nameWrapperAbi, registryAbi } from "./abis"

export type NameOwnership = { owner: Address | null; wrapped: boolean }

/** Registry owner, unwrapped through the NameWrapper when the name is wrapped. */
export async function getNameOwner(client: PublicClient, name: string): Promise<NameOwnership> {
  const node = namehash(name)
  let owner: Address
  try {
    owner = await client.readContract({ address: ENS_REGISTRY, abi: registryAbi, functionName: "owner", args: [node] })
  } catch {
    return { owner: null, wrapped: false }
  }
  if (isAddressEqual(owner, zeroAddress)) return { owner: null, wrapped: false }
  const wrapper = NAME_WRAPPER[client.chain!.id]
  if (wrapper && isAddressEqual(owner, wrapper)) {
    try {
      const real = await client.readContract({ address: wrapper, abi: nameWrapperAbi, functionName: "ownerOf", args: [BigInt(node)] })
      return { owner: isAddressEqual(real, zeroAddress) ? null : real, wrapped: true }
    } catch {
      return { owner: null, wrapped: true }
    }
  }
  return { owner, wrapped: false }
}
