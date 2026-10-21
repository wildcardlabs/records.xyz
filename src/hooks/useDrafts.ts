import { useCallback, useEffect, useState } from "react"
import type { Address, Hex } from "viem"
import type { AccountKind } from "./useRecord"

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
type Store = { adds: Draft[]; removals: Removal[]; texts: Record<string, string>; addrs: Record<string, string> }

const empty: Store = { adds: [], removals: [], texts: {}, addrs: {} }
const key = (chainId: number, name: string) => `records.xyz:drafts:${chainId}:${name}`

function load(k: string): Store {
  try {
    const raw = localStorage.getItem(k)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<Store>
    return { adds: parsed.adds ?? [], removals: parsed.removals ?? [], texts: parsed.texts ?? {}, addrs: parsed.addrs ?? {} }
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
      const n = next.adds.length + next.removals.length + Object.keys(next.texts).length + Object.keys(next.addrs).length
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
  const setText = useCallback(
    (key: string, value: string | null) =>
      update((s) => {
        const texts = { ...s.texts }
        if (value === null) delete texts[key]
        else texts[key] = value
        return { ...s, texts }
      }),
    [update]
  )
  const setAddr = useCallback(
    (coinType: number, value: string | null) =>
      update((s) => {
        const addrs = { ...s.addrs }
        if (value === null) delete addrs[String(coinType)]
        else addrs[String(coinType)] = value
        return { ...s, addrs }
      }),
    [update]
  )
  const profileCount = Object.keys(store.texts).length + Object.keys(store.addrs).length

  return {
    adds: store.adds,
    removals: store.removals,
    texts: store.texts,
    addrs: store.addrs,
    addDraft,
    dropDraft,
    markRemoval,
    unmarkRemoval,
    setText,
    setAddr,
    clear,
    accountCount: store.adds.length + store.removals.length,
    profileCount,
    pending: store.adds.length + store.removals.length + profileCount,
  }
}
