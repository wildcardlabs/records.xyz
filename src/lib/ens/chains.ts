import { arbitrum, base, mainnet, optimism, sepolia } from "viem/chains"
import type { Chain } from "viem"

export type ChainMeta = { chain: Chain; slug: string; label: string; explorer: string }

/** Chains an account can live on. */
export const ACCOUNT_CHAINS: ChainMeta[] = [
  { chain: mainnet, slug: "mainnet", label: "mainnet", explorer: "https://etherscan.io" },
  { chain: base, slug: "base", label: "base", explorer: "https://basescan.org" },
  { chain: optimism, slug: "optimism", label: "optimism", explorer: "https://optimistic.etherscan.io" },
  { chain: arbitrum, slug: "arbitrum", label: "arbitrum", explorer: "https://arbiscan.io" },
  { chain: sepolia, slug: "sepolia", label: "sepolia", explorer: "https://sepolia.etherscan.io" },
]

/** Chains where ENS records (and therefore the EIP-712 domain) live. */
export const RECORDS_CHAINS: ChainMeta[] = [
  ACCOUNT_CHAINS[0], // mainnet
  ACCOUNT_CHAINS[4], // sepolia
]

export const chainById = (id: number): ChainMeta | undefined => ACCOUNT_CHAINS.find((c) => c.chain.id === id)
export const chainBySlug = (slug: string): ChainMeta | undefined => ACCOUNT_CHAINS.find((c) => c.slug === slug)

export const DEFAULT_RECORDS_CHAIN = RECORDS_CHAINS[0]
