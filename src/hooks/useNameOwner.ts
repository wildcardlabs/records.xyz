import { useQuery } from "@tanstack/react-query"
import { publicClient } from "@/lib/ens/clients"
import { getNameOwner } from "@/lib/ens/ownership"

export function useNameOwner(name: string | undefined, recordsChainId: number) {
  return useQuery({
    queryKey: ["owner", recordsChainId, name],
    queryFn: () => getNameOwner(publicClient(recordsChainId), name!),
    enabled: !!name,
    staleTime: 60_000,
  })
}
