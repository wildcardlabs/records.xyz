import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { publicClient } from "@/lib/ens/clients"
import { getPublishAuthority } from "@/lib/ens/ownership"
import type { ResolverCapabilities } from "@/lib/ens/capabilities"

/** Can the connected account write ENSIP-28 records for this name on its resolver? */
export function usePublishAuthority(
  name: string | undefined,
  recordsChainId: number,
  resolver: Address | null | undefined,
  caps: ResolverCapabilities | null | undefined,
  account: Address | undefined,
  owner: Address | null | undefined
) {
  return useQuery({
    queryKey: ["publish-authority", recordsChainId, name, resolver, account, owner ?? null, caps?.roles, caps?.canModifyName],
    queryFn: () => getPublishAuthority(publicClient(recordsChainId), name!, resolver!, caps!, account!, owner ?? null),
    enabled: !!name && !!resolver && !!caps && !!account,
    staleTime: 60_000,
  })
}
