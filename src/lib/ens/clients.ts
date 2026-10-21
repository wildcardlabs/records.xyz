import { type PublicClient, createPublicClient, fallback, http } from "viem"
import { ACCOUNT_CHAINS } from "./chains"

const cache = new Map<number, PublicClient>()

/** Public RPCs tried in order; several so a single provider's bad hour does not take the page down. */
const DEFAULT_RPCS: Record<number, string[]> = {
  1: ["https://ethereum-rpc.publicnode.com", "https://eth.merkle.io", "https://cloudflare-eth.com"],
  8453: ["https://mainnet.base.org", "https://base-rpc.publicnode.com"],
  10: ["https://mainnet.optimism.io", "https://optimism-rpc.publicnode.com"],
  42161: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-one-rpc.publicnode.com"],
  11155111: ["https://ethereum-sepolia-rpc.publicnode.com", "https://sepolia.drpc.org", "https://1rpc.io/sepolia"],
}

/** Per-chain RPC list: VITE_RPC_URL_<chainId> override first, then our defaults, then the chain's own public RPC. */
function rpcUrls(chainId: number, chainDefault?: string): string[] {
  const env = import.meta.env as Record<string, string | undefined>
  const override = env[`VITE_RPC_URL_${chainId}`]
  const list = [...(override ? [override] : []), ...(DEFAULT_RPCS[chainId] ?? [])]
  if (chainDefault && !list.includes(chainDefault)) list.push(chainDefault)
  return list
}

export function publicClient(chainId: number): PublicClient {
  const hit = cache.get(chainId)
  if (hit) return hit
  const meta = ACCOUNT_CHAINS.find((c) => c.chain.id === chainId)
  if (!meta) throw new Error(`unsupported chain ${chainId}`)
  const urls = rpcUrls(chainId, meta.chain.rpcUrls.default.http[0])
  const client = createPublicClient({
    chain: meta.chain,
    transport: fallback(urls.map((u) => http(u, { batch: true, retryCount: 1, timeout: 12_000 })), { rank: false }),
    batch: { multicall: true },
  }) as PublicClient
  cache.set(chainId, client)
  return client
}
