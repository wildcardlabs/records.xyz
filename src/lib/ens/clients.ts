import { type PublicClient, createPublicClient, http } from "viem"
import { ACCOUNT_CHAINS } from "./chains"

const cache = new Map<number, PublicClient>()

/** Optional per-chain RPC override: VITE_RPC_URL_<chainId>. Falls back to the chain's public RPC. */
function rpcUrl(chainId: number): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>
  return env[`VITE_RPC_URL_${chainId}`]
}

export function publicClient(chainId: number): PublicClient {
  const hit = cache.get(chainId)
  if (hit) return hit
  const meta = ACCOUNT_CHAINS.find((c) => c.chain.id === chainId)
  if (!meta) throw new Error(`unsupported chain ${chainId}`)
  const client = createPublicClient({
    chain: meta.chain,
    transport: http(rpcUrl(chainId), { batch: true }),
    batch: { multicall: true },
  }) as PublicClient
  cache.set(chainId, client)
  return client
}
