import {
  type Address,
  type Hex,
  type PublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  getChainContractAddress,
  namehash,
  toHex,
} from "viem"
import { packetToBytes } from "viem/ens"
import { DATA_INTERFACE_ID, dataResolverAbi } from "./abis"

const LOCAL_BATCH_GATEWAY = "x-batch-gateway:true"

/** Universal Resolver `resolveWithGateways(bytes name, bytes data, string[] gateways)` → (bytes result, address resolver). */
const universalResolverResolveAbi = [
  {
    name: "resolveWithGateways",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "bytes" },
      { name: "data", type: "bytes" },
      { name: "gateways", type: "string[]" },
    ],
    outputs: [
      { name: "", type: "bytes" },
      { name: "address", type: "address" },
    ],
  },
] as const

/**
 * Resolver address for a name (ENSIP-10 aware, via the Universal Resolver).
 * Returns null only when the name genuinely has no resolver; network and RPC
 * failures are thrown so callers can tell "no resolver" from "could not check".
 */
export async function findResolver(client: PublicClient, name: string): Promise<Address | null> {
  try {
    return await client.getEnsResolver({ name })
  } catch (e) {
    const msg = String((e as Error).message ?? e)
    if (/ResolverNotFound|ResolverNotContract|returned no data|0x/.test(msg) && !/HTTP request failed|status of 5\d\d|timeout|fetch failed|rate limit|429/i.test(msg)) {
      return null
    }
    throw e
  }
}

export async function supportsDataRecords(client: PublicClient, resolver: Address): Promise<boolean> {
  try {
    return await client.readContract({
      address: resolver,
      abi: dataResolverAbi,
      functionName: "supportsInterface",
      args: [DATA_INTERFACE_ID],
    })
  } catch {
    return false
  }
}

/**
 * Read one ENSIP-24 data record through the Universal Resolver, so wildcard and
 * CCIP-read resolvers work the same as on-chain ones. Returns "0x" when empty.
 */
export async function readDataRecord(client: PublicClient, name: string, key: string): Promise<Hex> {
  const universalResolver = getChainContractAddress({ chain: client.chain!, contract: "ensUniversalResolver" })
  const calldata = encodeFunctionData({ abi: dataResolverAbi, functionName: "data", args: [namehash(name), key] })
  const [result] = await client.readContract({
    address: universalResolver,
    abi: universalResolverResolveAbi,
    functionName: "resolveWithGateways",
    args: [toHex(packetToBytes(name)), calldata, [LOCAL_BATCH_GATEWAY]],
  })
  if (!result || result === "0x") return "0x"
  try {
    return decodeFunctionResult({ abi: dataResolverAbi, functionName: "data", data: result })
  } catch {
    return "0x"
  }
}

/** Read several records; failures resolve to "0x" rather than failing the batch. */
export async function readDataRecords(client: PublicClient, name: string, keys: string[]): Promise<Record<string, Hex>> {
  const values = await Promise.all(keys.map((k) => readDataRecord(client, name, k).catch(() => "0x" as Hex)))
  return Object.fromEntries(keys.map((k, i) => [k, values[i]]))
}
