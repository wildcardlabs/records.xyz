import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { publicClient } from "@/lib/ens/clients"
import { fetchHcaOwners } from "@/lib/ens/hca"

/** which of these addresses are ENS App smart accounts, and whose; mainnet only */
export function useHcaOwners(addresses: (string | undefined)[]) {
  const list = [...new Set(addresses.filter((a): a is string => !!a).map((a) => a.toLowerCase()))].sort()
  return useQuery({
    queryKey: ["hca-owners", list],
    queryFn: () => fetchHcaOwners(publicClient(1), list as Address[]),
    enabled: list.length > 0,
    staleTime: 24 * 60 * 60_000,
    placeholderData: (prev) => prev,
  })
}
