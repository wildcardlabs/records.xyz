import type { Hex } from "viem"
import { BIGNAME_BASE } from "./bigname"
import { addressLabel } from "./profile"
import { CHAINS_KEY, decodeChains, decodeListing, parseListingKey, parseProofKey } from "@/lib/ensip28"
import { addressDef, contenthashDef, decodeValue, textDef } from "@/lib/records"
import { chainById } from "./chains"
import { shortAddr } from "@/lib/format"
import { POWER_LABEL, powersFromBigName } from "./roles"

/** One line of a name's history, ready to show. */
export type HistoryRow = {
  id: string
  /** unix seconds */
  at: number
  block: number
  tx: Hex
  /** which figure the change belongs to */
  group: "records" | "accounts" | "links" | "access" | "name"
  /** short noun for the change, e.g. "avatar" or "base address" */
  label: string
  /** what it became, or what happened */
  detail: string
  /** full value when the detail is truncated */
  full?: string
  /** the name the change belongs to; null for a change on a shared resolver record */
  name?: string | null
  /** the resolver and record the change was made on, when the indexer says */
  resolver?: string
  recordId?: string
  /** a wallet the row is about, linked to its names */
  address?: string
  /** what the indexer called it, plus the bits the action builder needs */
  meta: RowMeta
}

export type RowMeta = {
  action: string
  /** record writes: the key family and whether the value was cleared */
  family?: "text" | "addr" | "contenthash" | "abi" | "data" | "other"
  dataKind?: "chains" | "listing" | "proof" | "other"
  cleared?: boolean
  /** resolver_record_linked: the name that was linked */
  linkedName?: string
  /** permissions */
  added?: string[]
  removed?: string[]
  /** some permission events carry the full set after the change instead of a diff */
  powersNow?: string[]
  /** "registry", "registration" or "resolver" */
  scopeKind?: string
  approved?: boolean
  /** registrations and transfers */
  expiresAt?: string
  from?: string
  to?: string
  owner?: string
}

type RawEvent = {
  id?: string
  type?: string
  name?: string | null
  block_number?: number
  timestamp?: string
  transaction_hash?: string
  data?: {
    action?: string
    key?: string
    value?: unknown
    coin_type?: number
    record_id?: string
    resolver?: { address?: string }
    address?: string
    owner?: string
    from?: string
    to?: string
    expires_at?: string
    added_powers?: string[]
    removed_powers?: string[]
    name?: string
    sender?: string
    approved?: boolean
    dns_encoded_name?: string
    registrant?: string
    powers?: string[]
    grant_scope?: { kind?: string }
  }
}
type RawHistory = { data?: RawEvent[]; page?: { has_more?: boolean; next_cursor?: string | null } }

const clip = (s: string, n = 64) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const isEmptyHex = (v: unknown) => typeof v !== "string" || v === "" || v === "0x"

/** A record write, by key family. */
function recordRow(key: string, value: unknown, recordsChainId: number): Pick<HistoryRow, "group" | "label" | "detail" | "full" | "address"> & { meta: Omit<RowMeta, "action"> } {
  const str = typeof value === "string" ? value : ""
  // the indexer leaves the value out of some events; that is "changed", not "cleared"
  const unknown = value === undefined || value === null
  const [family, ...rest] = key.split(":")
  const arg = rest.join(":")
  if (key === "name") return { group: "records", label: "primary name", detail: unknown ? "changed" : str ? clip(str) : "cleared", full: str || undefined, meta: { family: "other", cleared: !unknown && !str } }
  if (family === "text") {
    const def = textDef(arg)
    return { group: "records", label: def.label === arg ? arg : `${def.label}`, detail: str ? clip(str) : unknown ? "changed" : "cleared", full: str || undefined, meta: { family: "text", cleared: !unknown && !str } }
  }
  if (family === "addr") {
    const ct = Number(arg)
    const def = addressDef(ct)
    const raw = isEmptyHex(str) ? "" : decodeValue(def, str)
    const decoded = /^0x0{40}$/i.test(raw) ? "" : raw
    return { group: "records", label: `${addressLabel(ct, recordsChainId).label} address`, detail: decoded ? (decoded.length > 20 ? shortAddr(decoded, 6) : decoded) : unknown ? "changed" : "cleared", full: decoded || undefined, meta: { family: "addr", cleared: !unknown && !decoded } }
  }
  if (family === "contenthash") {
    const decoded = isEmptyHex(str) ? "" : decodeValue(contenthashDef, str)
    return { group: "records", label: "content hash", detail: decoded ? clip(decoded) : unknown ? "changed" : "cleared", full: decoded || undefined, meta: { family: "contenthash", cleared: !unknown && !decoded } }
  }
  if (family === "data") {
    if (arg === CHAINS_KEY) {
      const chains = isEmptyHex(str) ? [] : (decodeChains(str as Hex) ?? [])
      return { group: "accounts", label: "chains with wallets", detail: chains.length ? chains.map((c) => chainById(c)?.label ?? `chain ${c}`).join(", ") : "none", meta: { family: "data", dataKind: "chains", cleared: chains.length === 0 } }
    }
    const proof = parseProofKey(arg)
    if (proof) return { group: "accounts", label: "consent", address: proof.account, detail: isEmptyHex(str) ? `removed on ${chainById(proof.chainId)?.label ?? proof.chainId}` : `signed on ${chainById(proof.chainId)?.label ?? proof.chainId}`, meta: { family: "data", dataKind: "proof", cleared: isEmptyHex(str) } }
    const listing = parseListingKey(arg)
    if (listing) {
      const accounts = isEmptyHex(str) ? [] : (decodeListing(str as Hex) ?? [])
      return { group: "accounts", label: `wallets on ${chainById(listing.chainId)?.label ?? listing.chainId}`, detail: accounts.length ? accounts.map((a) => shortAddr(a, 4)).join(", ") : "none", meta: { family: "data", dataKind: "listing", cleared: accounts.length === 0 } }
    }
    return { group: "records", label: `data · ${arg}`, detail: isEmptyHex(str) ? "cleared" : clip(str, 40), full: str || undefined, meta: { family: "data", dataKind: "other", cleared: isEmptyHex(str) } }
  }
  if (family === "abi") return { group: "records", label: "abi", detail: unknown ? "changed" : isEmptyHex(str) ? "cleared" : "set", meta: { family: "abi", cleared: !unknown && isEmptyHex(str) } }
  return { group: "records", label: key, detail: str ? clip(str) : unknown ? "changed" : "cleared", full: str || undefined, meta: { family: "other", cleared: !unknown && !str } }
}

/** "\x03seg\x03eth\x00" → "seg.eth" */
function decodeDnsName(hex: string): string | undefined {
  const bytes = hex.startsWith("0x") ? hex.slice(2) : hex
  const labels: string[] = []
  let i = 0
  while (i + 2 <= bytes.length) {
    const len = parseInt(bytes.slice(i, i + 2), 16)
    i += 2
    if (len === 0) break
    const chunk = bytes.slice(i, i + len * 2)
    i += len * 2
    try {
      labels.push(new TextDecoder().decode(new Uint8Array(chunk.match(/../g)!.map((h) => parseInt(h, 16)))))
    } catch {
      return undefined
    }
  }
  return labels.length ? labels.join(".") : undefined
}

/** a date, or "none" for the sentinel expiries some registrations carry */
export function expiryText(v: string | number): string {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 && n < 4_102_444_800 ? new Date(n * 1000).toISOString().slice(0, 10) : "none"
}

function toRow(e: RawEvent, recordsChainId: number): HistoryRow | null {
  if (!e.id || !e.timestamp || !e.transaction_hash) return null
  const d = e.data ?? {}
  const action = d.action ?? e.type ?? "event"
  const base = { id: e.id, at: Number(e.timestamp), block: e.block_number ?? 0, tx: e.transaction_hash as Hex, name: e.name ?? null, resolver: d.resolver?.address, recordId: d.record_id, meta: { action, expiresAt: d.expires_at, from: d.from, to: d.to, owner: d.owner, approved: d.approved, added: d.added_powers, removed: d.removed_powers, powersNow: d.powers, scopeKind: d.grant_scope?.kind } as RowMeta }
  switch (d.action) {
    case "record_changed": {
      if (!d.key) return null
      const r = recordRow(d.key, d.value, recordsChainId)
      return { ...base, ...r, meta: { ...base.meta, ...r.meta } }
    }
    case "resolver_record_linked": {
      const linkedName = d.dns_encoded_name ? decodeDnsName(d.dns_encoded_name) : undefined
      return { ...base, group: "links", label: "profile", name: linkedName ?? base.name, meta: { ...base.meta, linkedName }, detail: d.record_id && d.record_id !== "0" ? "started using a profile on this resolver" : "detached from its profile" }
    }
    case "resolver_changed":
      return { ...base, group: "name", label: "resolver", detail: d.resolver?.address ? `set to ${shortAddr(d.resolver.address, 6)}` : "changed" }
    case "permission_changed":
    case "root_permission_changed":
    case "roles_changed":
    case "eac_roles_changed": {
      // resolver roles have app labels; registry-level powers (who may set the resolver, create subnames, transfer) get plain words
      const REGISTRY_POWER: Record<string, string> = {
        set_resolver: "the resolver",
        set_subregistry: "subnames",
        can_transfer: "ownership",
        can_transfer_admin: "ownership",
        renew: "renewal",
        burn: "burning",
        set_token_observer: "the token observer",
        registration_control: "the registration",
        set_uri: "the token uri",
        set_parent: "the parent",
        unregister: "unregistering",
        registrar: "registrations",
        register_reserved: "reserved registrations",
      }
      const names = (list: string[] | undefined) => {
        const { powers } = powersFromBigName(list ?? [])
        const out = powers.map((p) => POWER_LABEL[p])
        for (const raw of list ?? []) {
          if (raw.startsWith("admin_")) continue
          const label = REGISTRY_POWER[raw]
          if (label && !out.includes(label)) out.push(label)
        }
        return out
      }
      const added = names(d.added_powers)
      const removed = names(d.removed_powers)
      const parts = [added.length ? `may now change ${added.join(", ")}` : "", removed.length ? `may no longer change ${removed.join(", ")}` : ""].filter(Boolean)
      if (!parts.length && d.powers) parts.push(d.powers.length ? `now ${names(d.powers).join(", ") || d.powers.join(", ").replace(/_/g, " ")}` : "no longer has access")
      return { ...base, group: "access", label: d.grant_scope?.kind === "registration" ? "registration control" : "permissions", address: d.address, detail: parts.join(" · ") || "changed" }
    }
    case "operator_approval_changed":
      return { ...base, group: "access", label: "operator", address: d.address, detail: d.approved === false ? "removed" : "approved" }
    case "reverse_changed":
      return { ...base, group: "name", label: "primary name", detail: d.address ? `set for ${shortAddr(d.address, 4)}` : "changed" }
    case "registration_granted":
      return { ...base, group: "name", label: "registered", detail: d.expires_at ? `until ${expiryText(d.expires_at)}` : "" }
    case "registration_renewed":
    case "expiry_changed":
      return { ...base, group: "name", label: "expiry", detail: d.expires_at ? `now ${expiryText(d.expires_at)}` : "changed" }
    case "registration_released":
      return { ...base, group: "name", label: "released", detail: "registration ended" }
    case "authority_changed":
    case "token_control_transferred":
      return { ...base, group: "name", label: "owner", address: d.owner ?? d.to, detail: d.owner ? `now ${shortAddr(d.owner, 4)}` : d.to ? `now ${shortAddr(d.to, 4)}` : "changed" }
    case "name_wrapped":
      return { ...base, group: "name", label: "wrapped", detail: "name wrapper (v1)" }
    case "migration_applied":
      return { ...base, group: "name", label: "migrated", detail: "moved to ENSv2" }
    default:
      return e.type ? { ...base, group: "name", label: e.type.replace(/_/g, " "), detail: d.action?.replace(/_/g, " ") ?? "" } : null
  }
}

/** One page of a name's history from BigName, newest first. null when no indexer covers the chain. */
export async function fetchNameHistory(recordsChainId: number, name: string, cursor?: string | null, pageSize = 25): Promise<{ rows: HistoryRow[]; nextCursor: string | null } | null> {
  const base = BIGNAME_BASE[recordsChainId]
  if (!base) return null
  return fetchHistoryPage(recordsChainId, `${base}/names/${encodeURIComponent(name)}/history`, cursor, pageSize)
}

/** One page of everything a wallet did or had done to its names, newest first. */
export async function fetchAddressHistory(recordsChainId: number, address: string, cursor?: string | null, pageSize = 25): Promise<{ rows: HistoryRow[]; nextCursor: string | null } | null> {
  const base = BIGNAME_BASE[recordsChainId]
  if (!base) return null
  return fetchHistoryPage(recordsChainId, `${base}/addresses/${address.toLowerCase()}/history`, cursor, pageSize)
}

async function fetchHistoryPage(recordsChainId: number, endpoint: string, cursor: string | null | undefined, pageSize: number): Promise<{ rows: HistoryRow[]; nextCursor: string | null }> {
  const url = `${endpoint}?include=data&page_size=${pageSize}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
  const res = await fetch(url, { headers: { accept: "application/json" } })
  if (res.status === 404) return { rows: [], nextCursor: null }
  if (!res.ok) throw new Error(`bigname ${res.status}`)
  const raw = (await res.json()) as RawHistory
  // one transaction can emit the same change through several events (a renewal updates expiry thrice); keep one line each
  const seen = new Set<string>()
  const rows = (raw.data ?? [])
    .map((e) => toRow(e, recordsChainId))
    .filter((r): r is HistoryRow => r !== null)
    .filter((r) => {
      const k = `${r.tx}:${r.label}:${r.detail}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  return { rows, nextCursor: raw.page?.has_more ? (raw.page.next_cursor ?? null) : null }
}

/** The whole history, newest first, up to `max` events (a few indexer pages), so tabs can filter and page locally. */
export async function fetchNameHistoryAll(recordsChainId: number, name: string, max = 500): Promise<HistoryRow[] | null> {
  return fetchAll((cursor) => fetchNameHistory(recordsChainId, name, cursor, 100), max)
}

/** A wallet's whole history, newest first, up to `max` events. */
export async function fetchAddressHistoryAll(recordsChainId: number, address: string, max = 500): Promise<HistoryRow[] | null> {
  return fetchAll((cursor) => fetchAddressHistory(recordsChainId, address, cursor, 100), max)
}

async function fetchAll(page: (cursor: string | null) => Promise<{ rows: HistoryRow[]; nextCursor: string | null } | null>, max: number): Promise<HistoryRow[] | null> {
  const rows: HistoryRow[] = []
  let cursor: string | null = null
  while (rows.length < max) {
    const p = await page(cursor)
    if (!p) return null
    rows.push(...p.rows)
    if (!p.nextCursor) break
    cursor = p.nextCursor
  }
  return rows
}
