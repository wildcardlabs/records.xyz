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

type Store = { adds: Draft[]; removals: Removal[] }

const empty: Store = { adds: [], removals: [] }
const key = (chainId: number, name: string) => `records.xyz:drafts:${chainId}:${name}`

function load(k: string): Store {
  try {
    const raw = localStorage.getItem(k)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<Store>
    return { adds: parsed.adds ?? [], removals: parsed.removals ?? [] }
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

  const write = useCallback(
    (next: Store) => {
      setStore(next)
      try {
        if (next.adds.length === 0 && next.removals.length === 0) localStorage.removeItem(k)
        else localStorage.setItem(k, JSON.stringify(next))
      } catch {
        /* storage unavailable: drafts live in memory only */
      }
    },
    [k]
  )

  const addDraft = useCallback(
    (d: Draft) => write({ adds: [...store.adds.filter((x) => !same(x, d)), d], removals: store.removals.filter((r) => !same(r, d)) }),
    [store, write]
  )
  const dropDraft = useCallback((d: Removal) => write({ ...store, adds: store.adds.filter((x) => !same(x, d)) }), [store, write])
  const markRemoval = useCallback(
    (r: Removal) => write({ adds: store.adds.filter((x) => !same(x, r)), removals: [...store.removals.filter((x) => !same(x, r)), r] }),
    [store, write]
  )
  const unmarkRemoval = useCallback((r: Removal) => write({ ...store, removals: store.removals.filter((x) => !same(x, r)) }), [store, write])
  const clear = useCallback(() => write(empty), [write])

  return { adds: store.adds, removals: store.removals, addDraft, dropDraft, markRemoval, unmarkRemoval, clear, pending: store.adds.length + store.removals.length }
}
