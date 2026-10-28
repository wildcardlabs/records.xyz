import { useInfiniteQuery } from "@tanstack/react-query"
import { hasBigName } from "@/lib/ens/bigname"
import { fetchAddressHistory, fetchNameHistory } from "@/lib/ens/history"

const PAGE = 100

/** A name's history from BigName, newest first, one indexer page at a time. */
export function useNameHistory(name: string | undefined, recordsChainId: number, enabled: boolean) {
  return useHistory({ name }, recordsChainId, enabled)
}

/**
 * The history of a name, or of everything a wallet owns: the first page shows at once,
 * the caller pulls the rest with `fetchNextPage`.
 */
export function useHistory(source: { name?: string; address?: string }, recordsChainId: number, enabled: boolean) {
  const key = source.name ?? source.address?.toLowerCase()
  return useInfiniteQuery({
    queryKey: ["history", recordsChainId, source.name ? "name" : "address", key],
    queryFn: ({ pageParam }) => (source.name ? fetchNameHistory(recordsChainId, source.name, pageParam, PAGE) : fetchAddressHistory(recordsChainId, source.address!, pageParam, PAGE)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last?.nextCursor ?? null,
    enabled: enabled && !!key && hasBigName(recordsChainId),
    staleTime: 60_000,
    retry: 1,
  })
}
