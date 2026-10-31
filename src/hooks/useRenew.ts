import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { publicClient } from "@/lib/ens/clients"
import { type Pricing, fetchRenewInfo, fetchRentPricing, quoteBudget, quoteDuration } from "@/lib/ens/renew"

const MAINNET = 1

/** the oracle's pricing for one payment token */
export function useRentPricing(token: Address) {
  return useQuery({ queryKey: ["rent-pricing", token], queryFn: () => fetchRentPricing(publicClient(MAINNET), token), staleTime: 60 * 60_000 })
}

export const renewInfoKey = (name: string) => ["renew-info", name]

export function useRenewInfo(name: string | null) {
  return useQuery({ queryKey: renewInfoKey(name ?? ""), queryFn: () => fetchRenewInfo(publicClient(MAINNET), name!), enabled: !!name, staleTime: 30_000, retry: 1 })
}

export type QuoteAsk =
  | { mode: "budget"; label: string | undefined; token: Address; budget: bigint | null }
  | { mode: "duration"; label: string | undefined; token: Address; renewer: Address | null; duration: bigint; pricing: Pricing | undefined }

/**
 * The contract-confirmed quote: by budget through ens-budget's `quoteRenewal`, by duration
 * through `getRenewPrice`. Either way the amount shown is the amount charged.
 */
export function useRenewQuote(ask: QuoteAsk, enabled: boolean) {
  const key = ask.mode === "budget" ? ["renew-quote", "budget", ask.label, ask.token, ask.budget?.toString() ?? ""] : ["renew-quote", "duration", ask.label, ask.token, ask.renewer, ask.duration.toString()]
  const ready = ask.mode === "budget" ? ask.budget !== null && ask.budget > 0n : !!ask.renewer && ask.duration > 0n && !!ask.pricing
  return useQuery({
    queryKey: key,
    queryFn: () => (ask.mode === "budget" ? quoteBudget(publicClient(MAINNET), ask.label!, ask.budget!, ask.token) : quoteDuration(publicClient(MAINNET), ask.pricing!, ask.renewer!, ask.label!, ask.duration, ask.token)),
    enabled: enabled && !!ask.label && ready,
    staleTime: 30_000,
    retry: false,
    placeholderData: (prev) => prev,
  })
}
