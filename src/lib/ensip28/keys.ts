import type { Address } from "viem"

/** `accounts-chains` — optional list of chain IDs that carry listings. */
export const CHAINS_KEY = "accounts-chains"

/** `accounts[<chain-id>]` — the listing of accounts on one chain. */
export function listingKey(chainId: number | bigint): string {
  return `accounts[${chainId.toString()}]`
}

/** `accounts[<chain-id>][<account>]` — the proof record for one listed account. Account is lowercase hex. */
export function proofKey(chainId: number | bigint, account: Address): string {
  return `accounts[${chainId.toString()}][${account.toLowerCase()}]`
}

const LISTING_RE = /^accounts\[(0|[1-9][0-9]*)\]$/
const PROOF_RE = /^accounts\[(0|[1-9][0-9]*)\]\[(0x[0-9a-f]{40})\]$/

export function parseListingKey(key: string): { chainId: number } | null {
  const m = LISTING_RE.exec(key)
  return m ? { chainId: Number(m[1]) } : null
}

export function parseProofKey(key: string): { chainId: number; account: Address } | null {
  const m = PROOF_RE.exec(key)
  return m ? { chainId: Number(m[1]), account: m[2] as Address } : null
}
