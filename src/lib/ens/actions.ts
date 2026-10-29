import type { Hex } from "viem"
import { type HistoryRow, expiryText } from "./history"
import { POWER_LABEL, powersFromBigName } from "./roles"
import { shortAddr } from "@/lib/format"

/**
 * History as people did it: one line per transaction and name, in plain words, with the
 * indexer's events underneath for anyone who wants them. A migration that emitted fifty
 * events reads "upgraded to ENSv2"; three record writes read "added wallet 0x12…".
 */
export type HistoryAction = {
  id: string
  at: number
  tx: Hex
  /** every kind of change inside, for the tabs */
  groups: HistoryRow["group"][]
  /** the names the action is about; empty when only a shared record is known */
  names: string[]
  resolver?: string
  recordId?: string
  text: string
  /** a wallet the action is about */
  address?: string
  events: HistoryRow[]
}

type Bucket = { key: string; name: string | null; resolver?: string; recordId?: string; rows: HistoryRow[] }

const REGISTRY_POWER: Record<string, string> = {
  set_resolver: "the resolver",
  set_subregistry: "subnames",
  can_transfer: "ownership",
  can_transfer_admin: "ownership",
  renew: "renewal",
  burn: "burning",
  set_token_observer: "the token observer",
  registrar: "registrations",
  register_reserved: "reserved registrations",
  registration_control: "the registration",
  set_uri: "the token uri",
  set_parent: "the parent",
  unregister: "unregistering",
}

function powerNames(list: string[] | undefined): string[] {
  const { powers } = powersFromBigName(list ?? [])
  const out = powers.map((p) => POWER_LABEL[p])
  for (const raw of list ?? []) {
    if (raw.startsWith("admin_")) continue
    const label = REGISTRY_POWER[raw]
    if (label && !out.includes(label)) out.push(label)
  }
  return out
}

const list = (xs: string[]) => (xs.length <= 3 ? xs.join(", ") : `${xs.slice(0, 2).join(", ")} and ${xs.length - 2} more`)
const uniq = <T,>(xs: T[]) => [...new Set(xs)]

/** the sentence for one bucket of events from one transaction */
function describe(b: Bucket, namesForRecord: (resolver: string, recordId: string) => string[], txHasMigration: boolean): { text: string; address?: string; groups: HistoryRow["group"][] } {
  const rows = b.rows
  const has = (a: string) => rows.some((r) => r.meta.action === a)
  const pieces: string[] = []
  let address: string | undefined
  let accessDescribed = false

  const records = rows.filter((r) => r.meta.action === "record_changed")
  const profileRows = records.filter((r) => r.meta.family !== "data" || r.meta.dataKind === "other")
  const proofs = records.filter((r) => r.meta.dataKind === "proof")
  const walletRowsOnly = records.filter((r) => r.meta.dataKind === "listing" || r.meta.dataKind === "chains")

  // a migration transaction reserves or registers the name in the new registry as it goes: that is the upgrade, not a fresh registration
  const migrated = has("migration_applied") || (txHasMigration && has("registration_granted"))
  if (migrated) {
    pieces.push("upgraded to ENSv2")
    if (profileRows.length) pieces.push(`profile copied: ${list(uniq(profileRows.map((r) => r.label)))}`)
  } else if (has("registration_granted")) {
    const exp = rows.find((r) => r.meta.action === "registration_granted")?.meta.expiresAt
    const until = exp ? expiryText(exp) : "none"
    pieces.push(until === "none" ? "registered" : `registered until ${until}`)
  } else if (has("registration_renewed") || has("expiry_changed")) {
    const exp = rows.find((r) => r.meta.action === "registration_renewed" || r.meta.action === "expiry_changed")?.meta.expiresAt
    pieces.push(exp ? `extended until ${expiryText(exp)}` : "extended")
  }
  if (has("registration_released")) pieces.push("released")
  if (has("name_wrapped")) pieces.push("wrapped (v1)")

  if (!migrated && !has("registration_granted")) {
    const transfer = rows.find((r) => r.meta.action === "token_transferred" || r.meta.action === "token_control_transferred" || r.meta.action === "authority_changed")
    if (transfer) {
      const to = transfer.meta.to ?? transfer.meta.owner
      if (to) {
        pieces.push(`owner now ${shortAddr(to, 4)}`)
        address = to
      }
    }
    const resolverChange = rows.find((r) => r.meta.action === "resolver_changed")
    if (resolverChange?.resolver) pieces.push(`resolver set to ${shortAddr(resolverChange.resolver, 4)}`)
  }

  for (const r of migrated || has("registration_granted") ? [] : rows.filter((r) => r.meta.action === "resolver_record_linked")) {
    if (r.recordId && r.recordId !== "0" && r.resolver) {
      const others = namesForRecord(r.resolver, r.recordId).filter((n) => n !== r.meta.linkedName)
      pieces.push(others.length ? `started using ${others[0]}'s profile` : "started using a shared profile")
    } else {
      pieces.push("stopped using a shared profile")
    }
  }

  if (proofs.length) {
    const added = proofs.filter((r) => !r.meta.cleared)
    const removed = proofs.filter((r) => r.meta.cleared)
    if (added.length) {
      pieces.push(added.length === 1 ? `added wallet ${shortAddr(added[0].address!, 4)}` : `added ${added.length} wallets`)
      address = added[0].address
    }
    if (removed.length) {
      pieces.push(removed.length === 1 ? `removed wallet ${shortAddr(removed[0].address!, 4)}` : `removed ${removed.length} wallets`)
      address = address ?? removed[0].address
    }
  } else if (walletRowsOnly.length && !migrated) {
    pieces.push("updated wallets on the record")
  }

  if (profileRows.length && !migrated) {
    const set = uniq(profileRows.filter((r) => !r.meta.cleared).map((r) => r.label))
    const cleared = uniq(profileRows.filter((r) => r.meta.cleared).map((r) => r.label))
    if (set.length) pieces.push(`updated ${list(set)}`)
    if (cleared.length) pieces.push(`cleared ${list(cleared)}`)
  }

  // ENSv2 role changes come as diffs and are real actions. ENSv1 approvals come as the whole set after the fact and
  // mostly mirror something else in the same transaction (a resolver change, a transfer): only read them on their own
  const allPerms = rows.filter((r) => ["permission_changed", "root_permission_changed", "roles_changed", "eac_roles_changed"].includes(r.meta.action))
  const onlyPerms = allPerms.length === rows.length
  const perms = allPerms.filter((r) => r.meta.added || r.meta.removed || onlyPerms)
  if (perms.length && !migrated && !has("registration_granted")) {
    const byAddr = new Map<string, { added: string[]; removed: string[]; cleared: boolean; now: string[] }>()
    for (const r of perms) {
      const k = r.address ?? "?"
      const e = byAddr.get(k) ?? { added: [], removed: [], cleared: false, now: [] }
      e.added.push(...powerNames(r.meta.added))
      e.removed.push(...powerNames(r.meta.removed))
      // events that carry the whole set after the change: empty means the access was taken away
      if (r.meta.powersNow && !r.meta.added && !r.meta.removed) {
        if (r.meta.powersNow.length === 0) e.cleared = true
        else e.now.push(...powerNames(r.meta.powersNow))
      }
      byAddr.set(k, e)
    }
    for (const [who, e] of byAddr) {
      const added = uniq([...e.added, ...e.now])
      const removed = uniq(e.removed)
      const name = who === "?" ? "a wallet" : shortAddr(who, 4)
      if (added.length && !removed.length && !e.cleared) pieces.push(`allowed ${name} to edit ${list(added)}`)
      else if ((removed.length || e.cleared) && !added.length) pieces.push(removed.length ? `revoked ${name}: ${list(removed)}` : `removed ${name}'s access`)
      else if (added.length || removed.length) pieces.push(`changed what ${name} may edit`)
      else pieces.push(`updated ${name}'s access`)
      address = address ?? (who === "?" ? undefined : who)
      accessDescribed = true
    }
  }

  for (const r of rows.filter((r) => r.meta.action === "operator_approval_changed")) {
    if (migrated || has("registration_granted")) break
    pieces.push(r.address ? `${r.meta.approved === false ? "removed" : "approved"} operator ${shortAddr(r.address, 4)}` : r.meta.approved === false ? "removed an operator" : "approved an operator")
    address = address ?? r.address
    accessDescribed = true
  }

  if (has("reverse_changed")) {
    const r = rows.find((x) => x.meta.action === "reverse_changed")
    pieces.push(r?.address ? `set as primary name for ${shortAddr(r.address, 4)}` : "set as primary name")
  }

  if (pieces.length === 0) {
    const rest = uniq(rows.map((r) => `${r.label}${r.detail ? ` ${r.detail}` : ""}`))
    pieces.push(...rest.slice(0, 3))
  }
  // the tabs filter on what the sentence says: a v1 approval that only mirrored a resolver change is not an access action
  const groups = uniq(rows.map((r) => r.group)).filter((g) => g !== "access" || accessDescribed || migrated)
  return { text: pieces.join(" · "), address, groups }
}

/**
 * Turn event rows (newest first) into actions: grouped by transaction, then by name; record
 * writes on a shared resolver record are grouped by that record and named through the
 * resolver's links; a migration absorbs the record copies made on its new resolver.
 */
export function buildActions(rows: HistoryRow[], namesForRecord: (resolver: string, recordId: string) => string[]): HistoryAction[] {
  const byTx = new Map<string, HistoryRow[]>()
  for (const r of rows) {
    const l = byTx.get(r.tx) ?? []
    l.push(r)
    byTx.set(r.tx, l)
  }
  const out: HistoryAction[] = []
  for (const [tx, txRows] of byTx) {
    const buckets = new Map<string, Bucket>()
    const put = (key: string, name: string | null, r: HistoryRow, extra: Partial<Bucket> = {}) => {
      const b = buckets.get(key) ?? { key, name, rows: [], ...extra }
      b.rows.push(r)
      buckets.set(key, b)
    }
    for (const r of txRows) {
      if (r.name) put(`n:${r.name}`, r.name, r)
      else if (r.meta.action === "record_changed" && r.resolver) put(`r:${r.resolver}:${r.recordId ?? "?"}`, null, r, { resolver: r.resolver, recordId: r.recordId })
      else if (r.meta.action === "operator_approval_changed") put("op", null, r)
      else put(`x:${r.meta.action}`, null, r)
    }
    const txHasMigration = txRows.some((r) => r.meta.action === "migration_applied")
    // record writes on a shared record belong to the names using it: when one of them has its own bucket here, fold them in
    for (const [k, b] of Array.from(buckets.entries())) {
      if (!k.startsWith("r:") || !b.resolver || !b.recordId) continue
      const owner = namesForRecord(b.resolver, b.recordId).map((n) => buckets.get(`n:${n}`)).find(Boolean)
      if (owner) {
        owner.rows.push(...b.rows)
        buckets.delete(k)
      }
    }
    // a migration sets a fresh resolver and copies the profile onto it in the same transaction: fold those copies in,
    // along with the registry-level grants and operator approvals it makes along the way
    const migrating = Array.from(buckets.values()).filter((b) => b.name && b.rows.some((r) => r.meta.action === "migration_applied"))
    if (migrating.length) {
      for (const [k, b] of Array.from(buckets.entries())) {
        if (k.startsWith("n:")) continue
        const resolver = b.resolver?.toLowerCase()
        const target = (k.startsWith("r:") && migrating.find((m) => m.rows.some((r) => r.meta.action === "resolver_changed" && r.resolver?.toLowerCase() === resolver))) || migrating[0]
        target.rows.push(...b.rows)
        buckets.delete(k)
      }
    }
    for (const b of buckets.values()) {
      const { text, address, groups } = describe(b, namesForRecord, txHasMigration)
      const names = b.name ? [b.name] : b.resolver && b.recordId ? namesForRecord(b.resolver, b.recordId) : []
      out.push({
        id: `${tx}:${b.key}`,
        at: b.rows[0].at,
        tx: tx as Hex,
        groups,
        names,
        resolver: b.resolver,
        recordId: b.recordId,
        text,
        address,
        events: b.rows,
      })
    }
  }
  return out
}
