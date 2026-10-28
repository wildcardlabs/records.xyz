import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { publicClient } from "@/lib/ens/clients"
import { fetchRenewInfo, fetchRentPricing, quoteRenew, quoteWithinBudget } from "@/lib/ens/renew"

const MAINNET = 1

export function useRentPricing() {
  return useQuery({ queryKey: ["rent-pricing"], queryFn: () => fetchRentPricing(publicClient(MAINNET)), staleTime: 60 * 60_000 })
}

export const renewInfoKey = (name: string) => ["renew-info", name]

export function useRenewInfo(name: string | null) {
  return useQuery({ queryKey: renewInfoKey(name ?? ""), queryFn: () => fetchRenewInfo(publicClient(MAINNET), name!), enabled: !!name, staleTime: 30_000, retry: 1 })
}

/**
 * The contract's own price for a term. With `maxAmount` the term is trimmed until the price
 * fits, which is how a budget becomes an exact duration.
 */
export function useRenewQuote(renewer: Address | null | undefined, label: string | undefined, seconds: bigint, token: Address, maxAmount?: bigint) {
  return useQuery({
    queryKey: ["renew-quote", renewer, label, seconds.toString(), token, maxAmount?.toString() ?? ""],
    queryFn: () => (maxAmount === undefined ? quoteRenew(publicClient(MAINNET), renewer!, label!, seconds, token).then((amount) => ({ seconds, amount })) : quoteWithinBudget(publicClient(MAINNET), renewer!, label!, seconds, token, maxAmount)),
    enabled: !!renewer && !!label && seconds > 0n,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}
