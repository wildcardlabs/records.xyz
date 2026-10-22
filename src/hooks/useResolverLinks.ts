import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { hasBigName } from "@/lib/ens/bigname"
import { publicClient } from "@/lib/ens/clients"
import { fetchResolverLinks, readLinks } from "@/lib/ens/links"

export const linksQueryKey = (recordsChainId: number, resolver: Address | null | undefined) => ["resolver-links", recordsChainId, resolver] as const

/**
 * Which record every name on an ENSv2 resolver reads. BigName lists every bound name; without an
 * indexer only this name and the root (the default record) are read from the resolver itself.
 */
export function useResolverLinks(name: string | undefined, recordsChainId: number, resolver: Address | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...linksQueryKey(recordsChainId, resolver), hasBigName(recordsChainId) ? "" : name],
    queryFn: async () => {
      const client = publicClient(recordsChainId)
      if (hasBigName(recordsChainId)) {
        try {
          const rows = await fetchResolverLinks(recordsChainId, resolver!)
          if (rows) {
            // the indexer lists names once a setter or link touched them; make sure this name and the root appear
            const own = await readLinks(client, resolver!, [name!])
            for (const r of own) if (!rows.some((x) => x.node.toLowerCase() === r.node.toLowerCase())) rows.push(r)
            return { rows, indexed: true }
          }
        } catch {
          /* indexer down: fall back to the chain */
        }
      }
      return { rows: await readLinks(client, resolver!, [name!]), indexed: false }
    },
    enabled: enabled && !!name && !!resolver,
    staleTime: 60_000,
    retry: 1,
  })
}
