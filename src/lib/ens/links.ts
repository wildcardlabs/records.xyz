import { type Address, type Hex, type PublicClient, encodeFunctionData, namehash, toHex } from "viem"
import { packetToBytes } from "viem/ens"
import { BIGNAME_BASE } from "./bigname"

/**
 * ENSv2 PermissionedResolver records and links. Every name a setter touches gets a record
 * (ids start at 1). `linkToRecord(name, id)` makes a name read and write another name's
 * record; `linkToRecord(name, 0)` detaches it. Names without a record fall back to the
 * default record, which is whatever the root name ("", DNS-encoded 0x00) is linked to.
 * Linking needs ROLE_LINK on the root resource.
 */
export const linkAbi = [
  { type: "function", name: "getRecordId", stateMutability: "view", inputs: [{ name: "node", type: "bytes32" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getRecordCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "linkToNode", stateMutability: "nonpayable", inputs: [{ name: "sourceName", type: "bytes" }, { name: "targetNode", type: "bytes32" }], outputs: [] },
  { type: "function", name: "linkToRecord", stateMutability: "nonpayable", inputs: [{ name: "sourceName", type: "bytes" }, { name: "recordId", type: "uint256" }], outputs: [] },
] as const

export const LINK_SELECTORS = {
  getRecordId: "faf10086",
  linkToRecord: "35378097",
} as const

export const ROOT_NAME = ""
export const ROOT_NODE = `0x${"0".repeat(64)}` as Hex
export const dnsName = (name: string) => toHex(packetToBytes(name))

/** One name bound to a resolver and the record it reads. recordId "0" means "the default record". */
export type ResolverLink = {
  name: string
  node: Hex
  /** decimal record id; "0" when the name has no record of its own */
  recordId: string
  /** the root name: whatever it links to is the default record */
  isDefault: boolean
}

type RawLinks = { data?: { name?: string; namehash?: string; record_id?: string; default?: boolean }[]; page?: { has_more?: boolean; next_cursor?: string | null } }

/** `GET /v1/resolvers/{chain}/{resolver}/links`: every name bound to the resolver with its record id. null without an indexer. */
export async function fetchResolverLinks(chainId: number, resolver: Address): Promise<ResolverLink[] | null> {
  const base = BIGNAME_BASE[chainId]
  if (!base) return null
  const out: ResolverLink[] = []
  let cursor: string | null = null
  for (let page = 0; page < 10; page++) {
    const url = `${base}/resolvers/${chainId}/${resolver.toLowerCase()}/links?page_size=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
    const res = await fetch(url, { headers: { accept: "application/json" } })
    if (res.status === 404) return out
    if (!res.ok) throw new Error(`bigname ${res.status}`)
    const raw = (await res.json()) as RawLinks
    for (const r of raw.data ?? []) {
      if (!r.namehash) continue
      out.push({ name: r.default ? ROOT_NAME : (r.name ?? ""), node: r.namehash as Hex, recordId: r.record_id ?? "0", isDefault: !!r.default })
    }
    if (!raw.page?.has_more || !raw.page.next_cursor) break
    cursor = raw.page.next_cursor
  }
  return out
}

type RawBound = { data?: { bound_names?: { data?: { name?: string; namehash?: string }[]; page?: { has_more?: boolean; next_cursor?: string | null } } } }

/**
 * `GET /v1/resolvers/{chain}/{resolver}`: every name whose registry entry points at this resolver,
 * including names that have never been written to and so have no record yet. null without an indexer.
 */
export async function fetchBoundNames(chainId: number, resolver: Address): Promise<{ name: string; node: Hex }[] | null> {
  const base = BIGNAME_BASE[chainId]
  if (!base) return null
  const out: { name: string; node: Hex }[] = []
  let cursor: string | null = null
  for (let page = 0; page < 20; page++) {
    const url = `${base}/resolvers/${chainId}/${resolver.toLowerCase()}?page_size=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
    const res = await fetch(url, { headers: { accept: "application/json" } })
    if (res.status === 404) return out
    if (!res.ok) throw new Error(`bigname ${res.status}`)
    const raw = (await res.json()) as RawBound
    const bound = raw.data?.bound_names
    for (const r of bound?.data ?? []) if (r.name && r.namehash && !r.name.includes("[")) out.push({ name: r.name, node: r.namehash as Hex })
    if (!bound?.page?.has_more || !bound.page.next_cursor) break
    cursor = bound.page.next_cursor
  }
  return out
}

/** Record ids straight from the resolver for a few names (this name and the root), when no indexer covers the chain. */
export async function readLinks(client: PublicClient, resolver: Address, names: string[]): Promise<ResolverLink[]> {
  const wanted = [...new Set([ROOT_NAME, ...names])]
  const ids = await Promise.all(
    wanted.map((n) => client.readContract({ address: resolver, abi: linkAbi, functionName: "getRecordId", args: [n ? namehash(n) : ROOT_NODE] }).catch(() => 0n))
  )
  return wanted.map((n, i) => ({ name: n, node: n ? namehash(n) : ROOT_NODE, recordId: ids[i].toString(), isDefault: n === ROOT_NAME }))
}

/** A staged link. Record ids travel as decimal strings because the drafts store is JSON. */
export type LinkChange = {
  /** the name whose record pointer changes; "" for the root name (sets the default record) */
  sourceName: string
  /** decimal record id to point at; "0" detaches the name */
  recordId: string
  /** human label, e.g. "alice.eth shows steve.eth's records" */
  scope: string
}

export function buildLinkCall(c: LinkChange): Hex {
  return encodeFunctionData({ abi: linkAbi, functionName: "linkToRecord", args: [dnsName(c.sourceName), BigInt(c.recordId)] })
}

export const sameLink = (a: LinkChange, b: LinkChange) => a.sourceName === b.sourceName

/**
 * Every name on the resolver and the record it reads, with record ids taken from the resolver
 * itself: the indexer can lag behind a link, and a stale id would show the wrong profile.
 */
export async function loadLinks(client: PublicClient, chainId: number, name: string, resolver: Address): Promise<{ rows: ResolverLink[]; indexed: boolean }> {
  let names: { name: string; node: Hex }[] = [{ name, node: namehash(name) }]
  let indexed = false
  if (BIGNAME_BASE[chainId]) {
    try {
      const [links, bound] = await Promise.all([fetchResolverLinks(chainId, resolver), fetchBoundNames(chainId, resolver).catch(() => null)])
      for (const r of [...(links ?? []), ...(bound ?? [])]) {
        if ("isDefault" in r && r.isDefault) continue
        if (!names.some((n) => n.node.toLowerCase() === r.node.toLowerCase())) names.push({ name: r.name, node: r.node })
      }
      indexed = links !== null
    } catch {
      /* indexer down: this name and the root still come from chain */
    }
  }
  names = names.filter((n) => n.name)
  const ids = await Promise.all(
    [ROOT_NODE, ...names.map((n) => n.node)].map((node) =>
      client.readContract({ address: resolver, abi: linkAbi, functionName: "getRecordId", args: [node] }).then((v) => v.toString()).catch(() => "0")
    )
  )
  const rows: ResolverLink[] = [{ name: ROOT_NAME, node: ROOT_NODE, recordId: ids[0], isDefault: true }]
  names.forEach((n, i) => rows.push({ name: n.name, node: n.node, recordId: ids[i + 1], isDefault: false }))
  return { rows, indexed }
}

/** The names that read the same record as `name`, excluding it. */
export function siblingsOf(rows: ResolverLink[] | undefined, name: string): string[] {
  if (!rows) return []
  const root = rows.find((r) => r.isDefault)?.recordId ?? "0"
  const eff = (r: ResolverLink) => (r.recordId !== "0" ? r.recordId : root)
  const me = rows.find((r) => !r.isDefault && r.name === name)
  const mine = me ? eff(me) : root
  if (mine === "0") return []
  return rows.filter((r) => !r.isDefault && r.name !== name && eff(r) === mine).map((r) => r.name)
}
