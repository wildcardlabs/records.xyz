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
