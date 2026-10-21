import { useQuery } from "@tanstack/react-query"
import { publicClient } from "@/lib/ens/clients"
import { fetchProfile } from "@/lib/ens/profile"

export function useProfile(name: string | undefined, recordsChainId: number) {
  return useQuery({
    queryKey: ["profile", recordsChainId, name],
    queryFn: () => fetchProfile(publicClient(recordsChainId), name!, recordsChainId),
    enabled: !!name,
    staleTime: 60_000,
    retry: 1,
  })
}
