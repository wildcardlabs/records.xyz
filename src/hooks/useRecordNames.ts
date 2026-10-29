import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { type ResolverLink, fetchResolverLinks } from "@/lib/ens/links"

/**
 * Which names use each record on a set of resolvers, so a change written to "record 4 on
 * 0xa8cb…" can be shown under seg.eth and stevegachau.eth. One indexer call per resolver.
 */
export function useRecordNames(chainId: number, resolvers: (string | undefined)[]) {
  const list = [...new Set(resolvers.filter((r): r is string => !!r).map((r) => r.toLowerCase()))].sort()
  const q = useQuery({
    queryKey: ["record-names", chainId, list],
    queryFn: async () => {
      const links = await Promise.all(list.map((r) => fetchResolverLinks(chainId, r as Address).catch(() => null)))
      const out: Record<string, ResolverLink[]> = {}
      list.forEach((r, i) => {
        out[r] = links[i] ?? []
      })
      return out
    },
    enabled: list.length > 0,
    staleTime: 5 * 60_000,
    // more resolvers arrive as history streams in: keep what is known while the rest loads
    placeholderData: (prev) => prev,
  })
  const data = q.data
  const namesForRecord = useCallback((resolver: string, recordId: string): string[] => (data?.[resolver.toLowerCase()] ?? []).filter((l) => !l.isDefault && l.recordId === recordId).map((l) => l.name), [data])
  return { namesForRecord, isLoading: q.isLoading }
}
