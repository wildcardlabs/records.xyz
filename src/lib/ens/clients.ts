import { type Chain, type PublicClient, createPublicClient, fallback, http } from "viem"
import { ACCOUNT_CHAINS } from "./chains"

const cache = new Map<number, PublicClient>()

/** Public RPCs tried in order; several so a single provider's bad hour does not take the page down. */
const DEFAULT_RPCS: Record<number, string[]> = {
  1: ["https://ethereum-rpc.publicnode.com", "https://eth.merkle.io", "https://cloudflare-eth.com"],
  8453: ["https://mainnet.base.org", "https://base-rpc.publicnode.com"],
  10: ["https://mainnet.optimism.io", "https://optimism-rpc.publicnode.com"],
  42161: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-one-rpc.publicnode.com"],
}

/** Per-chain RPC list: VITE_RPC_URL_<chainId> override first, then our defaults, then the chain's own public RPC. */
function rpcUrls(chainId: number, chainDefault?: string): string[] {
  const env = import.meta.env as Record<string, string | undefined>
  const override = env[`VITE_RPC_URL_${chainId}`]
  const list = [...(override ? [override] : []), ...(DEFAULT_RPCS[chainId] ?? [])]
  if (chainDefault && !list.includes(chainDefault)) list.push(chainDefault)
  return list
}

/** A client for any viem chain, cached by id. Used for chains outside ACCOUNT_CHAINS, such as testnet L2 reverse registrars. */
export function publicClientFor(chain: Chain): PublicClient {
  const hit = cache.get(chain.id)
  if (hit) return hit
  const urls = rpcUrls(chain.id, chain.rpcUrls.default.http[0])
  const client = createPublicClient({
    chain,
    transport: fallback(urls.map((u) => http(u, { batch: true, retryCount: 1, timeout: 12_000 })), { rank: false }),
    batch: { multicall: true },
  }) as PublicClient
  cache.set(chain.id, client)
  return client
}

export function publicClient(chainId: number): PublicClient {
  const meta = ACCOUNT_CHAINS.find((c) => c.chain.id === chainId)
  if (!meta) throw new Error(`unsupported chain ${chainId}`)
  return publicClientFor(meta.chain)
}
