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
  /** a wallet the row is about, linked to its names */
  address?: string
}

type RawEvent = {
  id?: string
  type?: string
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
  }
}
type RawHistory = { data?: RawEvent[]; page?: { has_more?: boolean; next_cursor?: string | null } }

const clip = (s: string, n = 64) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const isEmptyHex = (v: unknown) => typeof v !== "string" || v === "" || v === "0x"

/** A record write, by key family. */
function recordRow(key: string, value: unknown, recordsChainId: number): Pick<HistoryRow, "group" | "label" | "detail" | "full" | "address"> {
  const str = typeof value === "string" ? value : ""
  const [family, ...rest] = key.split(":")
  const arg = rest.join(":")
  if (family === "text") {
    const def = textDef(arg)
    return { group: "records", label: def.label === arg ? arg : `${def.label}`, detail: str ? clip(str) : "cleared", full: str || undefined }
  }
  if (family === "addr") {
    const ct = Number(arg)
    const def = addressDef(ct)
    const decoded = isEmptyHex(str) ? "" : decodeValue(def, str)
    return { group: "records", label: `${addressLabel(ct, recordsChainId).label} address`, detail: decoded ? (decoded.length > 20 ? shortAddr(decoded, 6) : decoded) : "cleared", full: decoded || undefined }
  }
  if (family === "contenthash") {
    const decoded = isEmptyHex(str) ? "" : decodeValue(contenthashDef, str)
    return { group: "records", label: "content hash", detail: decoded ? clip(decoded) : "cleared", full: decoded || undefined }
  }
  if (family === "data") {
    if (arg === CHAINS_KEY) {
      const chains = isEmptyHex(str) ? [] : (decodeChains(str as Hex) ?? [])
      return { group: "accounts", label: "chains with wallets", detail: chains.length ? chains.map((c) => chainById(c)?.label ?? `chain ${c}`).join(", ") : "none" }
    }
    const proof = parseProofKey(arg)
    if (proof) return { group: "accounts", label: "consent", address: proof.account, detail: isEmptyHex(str) ? `removed on ${chainById(proof.chainId)?.label ?? proof.chainId}` : `signed on ${chainById(proof.chainId)?.label ?? proof.chainId}` }
    const listing = parseListingKey(arg)
    if (listing) {
      const accounts = isEmptyHex(str) ? [] : (decodeListing(str as Hex) ?? [])
      return { group: "accounts", label: `wallets on ${chainById(listing.chainId)?.label ?? listing.chainId}`, detail: accounts.length ? accounts.map((a) => shortAddr(a, 4)).join(", ") : "none" }
    }
    return { group: "records", label: `data · ${arg}`, detail: isEmptyHex(str) ? "cleared" : clip(str, 40), full: str || undefined }
  }
  if (family === "abi") return { group: "records", label: "abi", detail: isEmptyHex(str) ? "cleared" : "set" }
  return { group: "records", label: key, detail: str ? clip(str) : "changed", full: str || undefined }
}

function toRow(e: RawEvent, recordsChainId: number): HistoryRow | null {
  if (!e.id || !e.timestamp || !e.transaction_hash) return null
  const base = { id: e.id, at: Number(e.timestamp), block: e.block_number ?? 0, tx: e.transaction_hash as Hex }
  const d = e.data ?? {}
  switch (d.action) {
    case "record_changed":
      return d.key ? { ...base, ...recordRow(d.key, d.value, recordsChainId) } : null
    case "resolver_record_linked":
      return { ...base, group: "links", label: "profile", detail: d.record_id && d.record_id !== "0" ? "started using a profile on this resolver" : "detached from its profile" }
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
      return { ...base, group: "access", label: "permissions", address: d.address, detail: parts.join(" · ") || "changed" }
    }
    case "reverse_changed":
      return { ...base, group: "name", label: "primary name", detail: d.address ? `set for ${shortAddr(d.address, 4)}` : "changed" }
    case "registration_granted":
      return { ...base, group: "name", label: "registered", detail: d.expires_at ? `until ${new Date(Number(d.expires_at) * 1000).toISOString().slice(0, 10)}` : "" }
    case "registration_renewed":
    case "expiry_changed":
      return { ...base, group: "name", label: "expiry", detail: d.expires_at ? `now ${new Date(Number(d.expires_at) * 1000).toISOString().slice(0, 10)}` : "changed" }
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
  const url = `${base}/names/${encodeURIComponent(name)}/history?include=data&page_size=${pageSize}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
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
  const rows: HistoryRow[] = []
  let cursor: string | null = null
  while (rows.length < max) {
    const page = await fetchNameHistory(recordsChainId, name, cursor, 100)
    if (!page) return null
    rows.push(...page.rows)
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }
  return rows
}
