import type { Address } from "viem"
import { BIGNAME_BASE } from "./bigname"
import { publicClient } from "./clients"
import { RECORDS_CHAINS } from "./chains"

/** A name the connected wallet owns or manages, on one records chain. */
export type MyName = {
  name: string
  chainId: number
  /** "owner", "manager", "primary" (the wallet's reverse record) */
  relations: string[]
  authority: "ens_v1" | "ens_v2" | null
  isPrimary: boolean
  expiresAt: number | null
}

type RawNames = {
  data?: { name?: string; namespace?: string; relations?: string[]; authority?: string; is_primary?: boolean; expires_at?: string | null; status?: string }[]
  page?: { has_more?: boolean; next_cursor?: string | null }
}

/** statuses that mean the registration is gone for good */
const RELEASED = new Set(["released", "available", "burned", "revoked"])

const isReverse = (n: string) => n.endsWith(".addr.reverse") || n.endsWith(".reverse")
const isEthSecondLevel = (n: string) => n.endsWith(".eth") && n.split(".").length === 2
/** some registrations carry sentinel expiries far past any real date; treat those as "no expiry" */
const saneExpiry = (v: string | null | undefined): number | null => {
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 && n < 4_102_444_800 ? n : null
}

/** BigName `GET /v1/addresses/{address}/names`: every name this address owns or manages on a chain the indexer covers. */
async function fetchIndexedNames(chainId: number, address: Address): Promise<MyName[]> {
  const base = BIGNAME_BASE[chainId]
  if (!base) return []
  const out: MyName[] = []
  let cursor: string | null = null
  for (let page = 0; page < 20; page++) {
    const url = `${base}/addresses/${address.toLowerCase()}/names?relation=owner,manager&page_size=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
    const res = await fetch(url, { headers: { accept: "application/json" } })
    if (res.status === 404) return out
    if (!res.ok) throw new Error(`bigname ${res.status}`)
    const raw = (await res.json()) as RawNames
    for (const r of raw.data ?? []) {
      if (!r.name || r.namespace !== "ens" || isReverse(r.name) || r.name.includes("[")) continue
      // keep expired names: they can still be extended during the grace period, and the list marks them
      if (r.status && RELEASED.has(r.status)) continue
      out.push({
        name: r.name,
        chainId,
        relations: (r.relations ?? []).filter((x) => x === "owner" || x === "manager"),
        authority: r.authority === "ens_v2" ? "ens_v2" : r.authority === "ens_v1" || r.authority === "ens_v0" ? "ens_v1" : null,
        isPrimary: !!r.is_primary,
        // only a registration expires: a .eth second-level name, or any name on ENSv2. for a v1 subname the
        // indexer reports the NameWrapper's expiry, which with no fuses burned changes nothing when it passes
        expiresAt: r.authority === "ens_v2" || isEthSecondLevel(r.name) ? saneExpiry(r.expires_at) : null,
      })
    }
    if (!raw.page?.has_more || !raw.page.next_cursor) break
    cursor = raw.page.next_cursor
  }
  return out
}

/** Without an indexer only the wallet's primary name is known. */
async function fetchPrimaryName(chainId: number, address: Address): Promise<MyName[]> {
  try {
    const name = await publicClient(chainId).getEnsName({ address })
    return name ? [{ name, chainId, relations: ["primary"], authority: null, isPrimary: true, expiresAt: null }] : []
  } catch {
    return []
  }
}

/**
 * The connected wallet's names on every records chain: indexed where BigName covers the chain,
 * the primary name elsewhere. Sorted primary first, then by name.
 */
export async function fetchMyNames(address: Address): Promise<{ names: MyName[]; indexedChains: number[] }> {
  const indexedChains = RECORDS_CHAINS.map((c) => c.chain.id).filter((id) => id in BIGNAME_BASE)
  const perChain = await Promise.all(
    RECORDS_CHAINS.map((c) => (c.chain.id in BIGNAME_BASE ? fetchIndexedNames(c.chain.id, address).catch(() => fetchPrimaryName(c.chain.id, address)) : fetchPrimaryName(c.chain.id, address)))
  )
  const seen = new Set<string>()
  const names = perChain
    .flat()
    .filter((n) => {
      const k = `${n.chainId}:${n.name}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .sort((a, b) => a.chainId - b.chainId || Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name))
  return { names, indexedChains }
}
