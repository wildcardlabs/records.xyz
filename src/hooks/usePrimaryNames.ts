import { useQueries, useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { fetchPrimaryNames } from "@/lib/ens/primary"

export const primaryQueryKey = (recordsChainId: number, address: Address | undefined) => ["primary-names", recordsChainId, address?.toLowerCase()] as const

/** What every chain calls one address. */
export function usePrimaryNames(address: Address | undefined, recordsChainId: number) {
  return useQuery({
    queryKey: primaryQueryKey(recordsChainId, address),
    queryFn: () => fetchPrimaryNames(address!, recordsChainId),
    enabled: !!address,
    staleTime: 60_000,
    retry: 1,
  })
}

/** The same, for each address on a profile card (a handful at most). */
export function usePrimaryNamesFor(addresses: Address[], recordsChainId: number) {
  return useQueries({
    queries: addresses.map((address) => ({
      queryKey: primaryQueryKey(recordsChainId, address),
      queryFn: () => fetchPrimaryNames(address, recordsChainId),
      staleTime: 60_000,
      retry: 1,
    })),
  })
}
