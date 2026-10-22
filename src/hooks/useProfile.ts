import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { publicClient } from "@/lib/ens/clients"
import { profileFromRecordSet } from "@/lib/ens/profile"
import { fetchRecordSet } from "@/lib/ens/recordset"
import { type RecordDef, defFromId } from "@/lib/records"

export const profileQueryKey = (name: string, recordsChainId: number) => ["profile", recordsChainId, name] as const

/**
 * Every record the app shows for a name, in stored form. `extraIds` are record ids the caller
 * also wants read (staged custom keys, say) when the chain, not the indexer, answers.
 */
export function useRecordSet(name: string | undefined, recordsChainId: number, extraIds: string[] = []) {
  const extraKey = extraIds.slice().sort().join(",")
  return useQuery({
    queryKey: [...profileQueryKey(name ?? "", recordsChainId), extraKey],
    queryFn: () => {
      const defs = extraIds.map(defFromId).filter((d): d is RecordDef => d !== null)
      return fetchRecordSet(publicClient(recordsChainId), name!, recordsChainId, defs)
    },
    enabled: !!name,
    staleTime: 60_000,
    retry: 1,
  })
}

/** The record set plus its human-facing projection for the profile card. */
export function useProfile(name: string | undefined, recordsChainId: number, extraIds: string[] = []) {
  const q = useRecordSet(name, recordsChainId, extraIds)
  const data = useMemo(() => (q.data && name ? profileFromRecordSet(q.data, name, recordsChainId) : undefined), [q.data, name, recordsChainId])
  return { data, set: q.data, isLoading: q.isLoading, isFetching: q.isFetching, isError: q.isError, refetch: q.refetch }
}
