import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { fetchResolverRoles, hasBigName } from "@/lib/ens/bigname"

/** Who holds roles on an ENSv2 resolver, from BigName. null when no indexer covers the chain. */
export function useResolverRoles(recordsChainId: number, resolver: Address | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["resolver-roles", recordsChainId, resolver],
    queryFn: () => fetchResolverRoles(recordsChainId, resolver!),
    enabled: enabled && !!resolver && hasBigName(recordsChainId),
    staleTime: 60_000,
    retry: 1,
  })
}
