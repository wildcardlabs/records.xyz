import { useQuery } from "@tanstack/react-query"
import { hasBigName } from "@/lib/ens/bigname"
import { fetchNameHistoryAll } from "@/lib/ens/history"

/** A name's whole history from BigName, newest first. */
export function useNameHistory(name: string | undefined, recordsChainId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["name-history", recordsChainId, name],
    queryFn: () => fetchNameHistoryAll(recordsChainId, name!),
    enabled: enabled && !!name && hasBigName(recordsChainId),
    staleTime: 60_000,
    retry: 1,
  })
}
