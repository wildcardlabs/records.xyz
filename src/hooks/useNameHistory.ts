import { useQuery } from "@tanstack/react-query"
import { hasBigName } from "@/lib/ens/bigname"
import { fetchAddressHistoryAll, fetchNameHistoryAll } from "@/lib/ens/history"

/** A name's whole history from BigName, newest first. */
export function useNameHistory(name: string | undefined, recordsChainId: number, enabled: boolean) {
  return useHistory({ name }, recordsChainId, enabled)
}

/** The whole history of a name, or of everything a wallet owns, newest first. */
export function useHistory(source: { name?: string; address?: string }, recordsChainId: number, enabled: boolean) {
  const key = source.name ?? source.address?.toLowerCase()
  return useQuery({
    queryKey: ["history", recordsChainId, source.name ? "name" : "address", key],
    queryFn: () => (source.name ? fetchNameHistoryAll(recordsChainId, source.name) : fetchAddressHistoryAll(recordsChainId, source.address!)),
    enabled: enabled && !!key && hasBigName(recordsChainId),
    staleTime: 60_000,
    retry: 1,
  })
}
