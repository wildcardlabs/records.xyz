import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { publicClient } from "@/lib/ens/clients"
import { loadLinks } from "@/lib/ens/links"

export const linksQueryKey = (recordsChainId: number, resolver: Address | null | undefined) => ["resolver-links", recordsChainId, resolver] as const

/** Which record every name on an ENSv2 resolver reads, with ids read from the resolver itself. */
export function useResolverLinks(name: string | undefined, recordsChainId: number, resolver: Address | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...linksQueryKey(recordsChainId, resolver), name],
    queryFn: () => loadLinks(publicClient(recordsChainId), recordsChainId, name!, resolver!),
    enabled: enabled && !!name && !!resolver,
    staleTime: 60_000,
    retry: 1,
  })
}
