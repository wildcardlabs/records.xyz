import { type Address, type Chain, namehash } from "viem"
import { arbitrum, base, mainnet, optimism } from "viem/chains"
import { publicClientFor } from "./clients"

/**
 * Primary names per chain (ENSIP-19). Three places can answer "what is this address called":
 * - the home chain's reverse registrar (`<addr>.addr.reverse`, the classic v1 path);
 * - an L2's own reverse registrar, a contract on that L2 at a fixed address;
 * - the default reverse registrar on the home chain, which every EVM chain falls back to.
 * All three expose `setName(string)` for the caller's own address.
 */
export type PrimaryKind = "default" | "home" | "l2"
export type PrimaryTarget = { kind: PrimaryKind; chain: Chain; label: string; registrar: Address; explorer: string }

const MAINNET_TARGETS: PrimaryTarget[] = [
  { kind: "default", chain: mainnet, label: "every EVM chain", registrar: "0x283F227c4Bd38ecE252C4Ae7ECE650B0e913f1f9", explorer: "https://etherscan.io" },
  { kind: "home", chain: mainnet, label: "ethereum", registrar: "0xa58E81fe9b61B5c3fE2AFD33CF304c454AbFc7Cb", explorer: "https://etherscan.io" },
  { kind: "l2", chain: base, label: "base", registrar: "0x0000000000D8e504002cC26E3Ec46D81971C1664", explorer: "https://basescan.org" },
  { kind: "l2", chain: optimism, label: "optimism", registrar: "0x0000000000D8e504002cC26E3Ec46D81971C1664", explorer: "https://optimistic.etherscan.io" },
  { kind: "l2", chain: arbitrum, label: "arbitrum", registrar: "0x0000000000D8e504002cC26E3Ec46D81971C1664", explorer: "https://arbiscan.io" },
]

export const primaryTargets = (_recordsChainId: number): PrimaryTarget[] => MAINNET_TARGETS

export const reverseRegistrarAbi = [
  // the v1 registrar returns the node, the default and L2 registrars return nothing; declare none so both decode
  { type: "function", name: "setName", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }], outputs: [] },
  { type: "function", name: "nameForAddr", stateMutability: "view", inputs: [{ name: "addr", type: "address" }], outputs: [{ type: "string" }] },
] as const

const nameResolverAbi = [{ type: "function", name: "name", stateMutability: "view", inputs: [{ type: "bytes32" }], outputs: [{ type: "string" }] }] as const
const registryResolverAbi = [{ type: "function", name: "resolver", stateMutability: "view", inputs: [{ type: "bytes32" }], outputs: [{ type: "address" }] }] as const

/** What one chain calls an address, and whether that came from the chain itself or the default. */
export type PrimaryRow = { target: PrimaryTarget; name: string | null; viaDefault: boolean }

const REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as const

async function homeName(chain: Chain, address: Address): Promise<string | null> {
  const client = publicClientFor(chain)
  const node = namehash(`${address.slice(2).toLowerCase()}.addr.reverse`)
  try {
    const resolver = await client.readContract({ address: REGISTRY, abi: registryResolverAbi, functionName: "resolver", args: [node] })
    if (!resolver || /^0x0{40}$/.test(resolver)) return null
    const n = await client.readContract({ address: resolver, abi: nameResolverAbi, functionName: "name", args: [node] })
    return n || null
  } catch {
    return null
  }
}

async function registrarName(target: PrimaryTarget, address: Address): Promise<string | null> {
  try {
    const n = await publicClientFor(target.chain).readContract({ address: target.registrar, abi: reverseRegistrarAbi, functionName: "nameForAddr", args: [address] })
    return n || null
  } catch {
    return null
  }
}

/** The address's primary name on every chain the app knows, with the ENSIP-19 default fallback applied. */
export async function fetchPrimaryNames(address: Address, recordsChainId: number): Promise<PrimaryRow[]> {
  const targets = primaryTargets(recordsChainId)
  const dflt = targets.find((t) => t.kind === "default")!
  const defaultName = await registrarName(dflt, address)
  const rows = await Promise.all(
    targets.map(async (target): Promise<PrimaryRow> => {
      if (target.kind === "default") return { target, name: defaultName, viaDefault: false }
      const own = target.kind === "home" ? await homeName(target.chain, address) : await registrarName(target, address)
      return own ? { target, name: own, viaDefault: false } : { target, name: defaultName, viaDefault: !!defaultName }
    })
  )
  return rows
}

/** The target that answers for an address record's coin type on this records chain. */
export function targetForCoin(coinType: number, recordsChainId: number): PrimaryTarget | undefined {
  const targets = primaryTargets(recordsChainId)
  if (coinType === 0x80000000) return targets.find((t) => t.kind === "default")
  if (coinType === 60) return targets.find((t) => t.kind === "home")
  const chainId = coinType > 0x80000000 ? coinType - 0x80000000 : null
  return targets.find((t) => t.kind === "l2" && t.chain.id === chainId)
}
