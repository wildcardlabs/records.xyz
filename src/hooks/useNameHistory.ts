import { useInfiniteQuery } from "@tanstack/react-query"
import { hasBigName } from "@/lib/ens/bigname"
import { fetchNameHistory } from "@/lib/ens/history"

/** A name's history from BigName, a page at a time. */
export function useNameHistory(name: string | undefined, recordsChainId: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["name-history", recordsChainId, name],
    queryFn: ({ pageParam }) => fetchNameHistory(recordsChainId, name!, pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last?.nextCursor ?? undefined,
    enabled: enabled && !!name && hasBigName(recordsChainId),
    staleTime: 60_000,
    retry: 1,
  })
}
