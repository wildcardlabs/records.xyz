import { useCallback, useEffect, useState } from "react"
import type { Address, Hex } from "viem"
import type { AccountKind } from "./useRecord"
import type { AccessChange } from "@/lib/ens/roles"
import { type LinkChange, sameLink } from "@/lib/ens/links"

export type Draft = {
  chainId: number
  account: Address
  kind: AccountKind
  /** unix seconds as a decimal string (bigint is not JSON) */
  expiresAt: string
  signature: Hex
  signedAt: number
}

export type Removal = { chainId: number; account: Address }

/** profile record changes: text key -> value ("" clears), coin type (as string) -> address ("" clears) */
/** records: def id -> stored value ("" or "0x" clears) */
type Store = { adds: Draft[]; removals: Removal[]; records: Record<string, string>; access: AccessChange[]; links: LinkChange[] }

const empty: Store = { adds: [], removals: [], records: {}, access: [], links: [] }
const key = (chainId: number, name: string) => `records.xyz:drafts:${chainId}:${name}`

function load(k: string): Store {
  try {
    const raw = localStorage.getItem(k)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<Store> & { texts?: Record<string, string>; addrs?: Record<string, string> }
    // older drafts kept texts and addrs separately; fold them into record ids
    const records: Record<string, string> = { ...parsed.records }
    for (const [k, v] of Object.entries(parsed.texts ?? {})) records[`text:${k}`] = v
    for (const [ct, v] of Object.entries(parsed.addrs ?? {})) records[`address:${ct}`] = v
    return { adds: parsed.adds ?? [], removals: parsed.removals ?? [], records, access: parsed.access ?? [], links: parsed.links ?? [] }
  } catch {
    return empty
  }
}

const same = (a: { chainId: number; account: string }, b: { chainId: number; account: string }) =>
  a.chainId === b.chainId && a.account.toLowerCase() === b.account.toLowerCase()

/** Pending, unpublished changes for one name, kept in the browser until the owner publishes. */
export function useDrafts(name: string | undefined, recordsChainId: number) {
  const k = key(recordsChainId, name ?? "")
  const [store, setStore] = useState<Store>(() => (name ? load(k) : empty))

  useEffect(() => {
    setStore(name ? load(k) : empty)
  }, [k, name])

  const persist = (next: Store) => {
    try {
      const n = next.adds.length + next.removals.length + Object.keys(next.records).length + next.access.length + next.links.length
      if (n === 0) localStorage.removeItem(k)
      else localStorage.setItem(k, JSON.stringify(next))
    } catch {
      /* storage unavailable: drafts live in memory only */
    }
  }
  /** every mutation goes through a functional update so rapid successive calls never clobber each other */
  const update = useCallback(
    (fn: (prev: Store) => Store) => {
      setStore((prev) => {
        const next = fn(prev)
        persist(next)
        return next
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [k]
  )

  const addDraft = useCallback(
    (d: Draft) => update((s) => ({ ...s, adds: [...s.adds.filter((x) => !same(x, d)), d], removals: s.removals.filter((r) => !same(r, d)) })),
    [update]
  )
  const dropDraft = useCallback((d: Removal) => update((s) => ({ ...s, adds: s.adds.filter((x) => !same(x, d)) })), [update])
  const markRemoval = useCallback(
    (r: Removal) => update((s) => ({ ...s, adds: s.adds.filter((x) => !same(x, r)), removals: [...s.removals.filter((x) => !same(x, r)), r] })),
    [update]
  )
  const unmarkRemoval = useCallback((r: Removal) => update((s) => ({ ...s, removals: s.removals.filter((x) => !same(x, r)) })), [update])
  const clear = useCallback(() => update(() => empty), [update])
  const setRecord = useCallback(
    (id: string, value: string | null) =>
      update((s) => {
        const records = { ...s.records }
        if (value === null) delete records[id]
        else records[id] = value
        return { ...s, records }
      }),
    [update]
  )
  const sameAccess = (a: AccessChange, b: AccessChange) => a.account.toLowerCase() === b.account.toLowerCase() && a.resource === b.resource && a.revoke === b.revoke
  const addAccess = useCallback((c: AccessChange) => update((s) => ({ ...s, access: [...s.access.filter((x) => !sameAccess(x, c)), c] })), [update])
  const dropAccess = useCallback((c: AccessChange) => update((s) => ({ ...s, access: s.access.filter((x) => !sameAccess(x, c)) })), [update])
  const addLink = useCallback((l: LinkChange) => update((s) => ({ ...s, links: [...s.links.filter((x) => !sameLink(x, l)), l] })), [update])
  const dropLink = useCallback((l: LinkChange) => update((s) => ({ ...s, links: s.links.filter((x) => !sameLink(x, l)) })), [update])
  const profileCount = Object.keys(store.records).length

  return {
    adds: store.adds,
    removals: store.removals,
    records: store.records,
    addDraft,
    dropDraft,
    markRemoval,
    unmarkRemoval,
    setRecord,
    access: store.access,
    addAccess,
    dropAccess,
    links: store.links,
    addLink,
    dropLink,
    clear,
    accountCount: store.adds.length + store.removals.length,
    profileCount,
    accessCount: store.access.length,
    linkCount: store.links.length,
    pending: store.adds.length + store.removals.length + profileCount + store.access.length + store.links.length,
  }
}
