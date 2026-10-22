import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { fetchMyNames } from "@/lib/ens/names"

/** Names the connected wallet owns or manages, across the records chains. */
export function useMyNames(address: Address | undefined) {
  return useQuery({
    queryKey: ["my-names", address?.toLowerCase()],
    queryFn: () => fetchMyNames(address!),
    enabled: !!address,
    staleTime: 60_000,
    retry: 1,
  })
}
