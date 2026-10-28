import type { Address, PublicClient } from "viem"

/**
 * ENSv2 hybrid contract accounts: a smart account the ENS App deploys per wallet and acts
 * through. The factory certifies which wallet owns each one, so a role holder that is an HCA
 * can be named instead of shown as a stranger.
 */
export const HCA_FACTORY: Address = "0x742bf21897a78e2c98cc5f5c5473a370a081e561"

const factoryAbi = [{ type: "function", name: "authorizedOwnerOf", stateMutability: "view", inputs: [{ name: "hca", type: "address" }], outputs: [{ type: "address" }] }] as const

const ZERO = "0x0000000000000000000000000000000000000000"

/** lowercase HCA address → the wallet it belongs to; addresses that are not HCAs are left out */
export async function fetchHcaOwners(client: PublicClient, addresses: Address[]): Promise<Record<string, Address>> {
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))] as Address[]
  const owners = await Promise.all(unique.map((a) => client.readContract({ address: HCA_FACTORY, abi: factoryAbi, functionName: "authorizedOwnerOf", args: [a] }).catch(() => ZERO)))
  const out: Record<string, Address> = {}
  unique.forEach((a, i) => {
    if (owners[i] !== ZERO) out[a] = owners[i] as Address
  })
  return out
}
