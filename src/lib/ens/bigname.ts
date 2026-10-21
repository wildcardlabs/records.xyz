import type { Address } from "viem"

/**
 * BigName: ENS Labs' indexer for ENS, ENSv2 and Basenames. Sepolia only for now; mainnet reads stay on chain.
 * Uses the documented product read `GET /v1/names/{name}` (source=indexed, the default); the response is
 * ETag-cacheable and the browser handles revalidation. Arbitrary data records (ENSIP-24) are outside the
 * indexer's grammar, so owned accounts are never read from here. Docs: https://bigname.sh/docs/
 */
export const BIGNAME_BASE: Record<number, string> = {
  11155111: "https://sepolia.api.bigname.sh/v1",
}

export type BigNameRecord = {
  name: string
  owner: Address | null
  manager: Address | null
  resolver: Address | null
  status: string | null
  authority: string | null
  expiresAt: number | null
  texts: Record<string, string>
  addresses: Record<string, string>
  primaryAddress: Address | null
  asOfBlock: number | null
  source: string | null
}

type Raw = {
  data?: {
    read_status?: string
    name?: string
    owner?: string
    manager?: string
    status?: string
    authority?: string
    expires_at?: string | number
    resolver?: { chain_id?: number; address?: string } | null
    records?: {
      texts?: Record<string, string>
      addresses?: Record<string, string>
    }
    primary_address?: string
  }
  meta?: { as_of?: Record<string, { block_number?: number }>; source?: string }
}

export const hasBigName = (chainId: number) => chainId in BIGNAME_BASE

/** Returns null when the indexer does not know the name (404). Throws on network failure. */
export async function fetchBigName(chainId: number, name: string): Promise<BigNameRecord | null> {
  const base = BIGNAME_BASE[chainId]
  if (!base) return null
  const res = await fetch(`${base}/names/${encodeURIComponent(name)}`, { headers: { accept: "application/json" } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`bigname ${res.status}`)
  const raw = (await res.json()) as Raw
  const d = raw.data ?? {}
  // the docs define read_status as the read outcome; anything but "ok" means the indexer could not serve this name
  if (d.read_status && d.read_status !== "ok") return null
  const addr = (v?: string | null): Address | null => (v && /^0x[0-9a-fA-F]{40}$/.test(v) && !/^0x0{40}$/.test(v) ? (v as Address) : null)
  const asOf = raw.meta?.as_of?.[String(chainId)]?.block_number ?? null
  return {
    name: d.name ?? name,
    owner: addr(d.owner),
    manager: addr(d.manager),
    resolver: addr(d.resolver?.address),
    status: d.status ?? null,
    authority: d.authority ?? null,
    expiresAt: d.expires_at != null ? Number(d.expires_at) : null,
    texts: d.records?.texts ?? {},
    addresses: d.records?.addresses ?? {},
    primaryAddress: addr(d.primary_address),
    asOfBlock: asOf,
    source: raw.meta?.source ?? null,
  }
}

export type BigNameRoleRow = { address: Address; resource: string; powers: string[] }

/** `GET /v1/resolvers/{chainId}/{resolver}/roles`: who holds which roles on a resolver, per resource ("0" = root). */
export async function fetchResolverRoles(chainId: number, resolver: Address): Promise<BigNameRoleRow[] | null> {
  const base = BIGNAME_BASE[chainId]
  if (!base) return null
  const res = await fetch(`${base}/resolvers/${chainId}/${resolver.toLowerCase()}/roles?page_size=200`, { headers: { accept: "application/json" } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`bigname ${res.status}`)
  const raw = (await res.json()) as { data?: { address?: string; eac_resource?: string; powers?: string[] }[] }
  return (raw.data ?? [])
    .filter((r) => r.address && /^0x[0-9a-fA-F]{40}$/.test(r.address))
    .map((r) => ({ address: r.address as Address, resource: r.eac_resource ?? "0", powers: r.powers ?? [] }))
}
