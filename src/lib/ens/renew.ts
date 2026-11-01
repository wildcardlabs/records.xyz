import { type Address, type Hex, type PublicClient, keccak256, labelhash, toBytes } from "viem"
import { EnsBudgetError, type Pricing, type Quote, type Solution, addresses, getPricing, prepareRenewal, priceOf, quoteRenewal, solve } from "ens-budget"

/**
 * Renewing .eth names on mainnet ENSv2, through the `ens-budget` package.
 *
 * Two renewers share one interface and one price oracle:
 *  - ETHRegistrar renews names migrated to ENSv2 (REGISTERED in the .eth registry);
 *  - ETHRenewerV1 renews names still on ENSv1 (RESERVED in the .eth registry) and syncs
 *    the v1 registrar, so the name's v1 expiry moves too.
 * Both take an ERC20 (USDC or DAI) and need an approval first. Anyone can renew any name.
 * The package picks the renewer, reads the oracle, solves a budget into the longest term
 * and confirms every price against the contract before anything is sent.
 */
export const RENEW = {
  registrar: addresses[1].ethRegistrar,
  renewerV1: addresses[1].ethRenewerV1,
  ethRegistry: "0xf60aba43e1f7f3dab1186ff03b561401c9df85e2",
  baseRegistrarV1: "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85",
} as const satisfies Record<string, Address>

export type PayToken = { symbol: "USDC" | "DAI"; address: Address; decimals: number }
export const PAY_TOKENS: PayToken[] = [
  { symbol: "USDC", address: addresses[1].usdc, decimals: 6 },
  { symbol: "DAI", address: addresses[1].dai, decimals: 18 },
]

export type { Pricing, Quote, Solution }
export { EnsBudgetError }

export const YEAR = 31_536_000n
const MONTH = YEAR / 12n
const DAY = 86_400n
/** ENSv2 grace period (28 days); the v1 renewer adds the 62-day premigration bonus on top. */
export const GRACE_V2 = 28n * DAY
export const GRACE_V1 = 90n * DAY

const renewerAbi = [
  { type: "function", name: "getRenewPrice", stateMutability: "view", inputs: [{ name: "label", type: "string" }, { name: "duration", type: "uint64" }, { name: "paymentToken", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "isRenewable", stateMutability: "view", inputs: [{ name: "label", type: "string" }], outputs: [{ type: "bool" }] },
] as const

const ethRegistryAbi = [
  {
    type: "function",
    name: "getState",
    stateMutability: "view",
    inputs: [{ name: "anyId", type: "uint256" }],
    outputs: [{ type: "tuple", components: [{ name: "status", type: "uint8" }, { name: "expiry", type: "uint64" }, { name: "latestOwner", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "resource", type: "uint256" }] }],
  },
] as const

const baseRegistrarAbi = [{ type: "function", name: "nameExpires", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "uint256" }] }] as const

// ---------------------------------------------------------------------------------- pricing

/** the oracle's rates, tiers and exchange rate for one payment token, read through the registrar */
export const fetchRentPricing = (client: PublicClient, token: Address): Promise<Pricing> => getPricing(client, { token })

export type Tier = { start: bigint; years: number; off: number }

/** every discount tier, best first, ending with the undiscounted base tier */
export function tiers(p: Pricing): Tier[] {
  const d = p.discountDenominator
  const out: Tier[] = p.discountPoints.map((pt) => ({
    start: pt.duration,
    years: pt.duration % YEAR === 0n ? Number(pt.duration / YEAR) : Number(pt.duration) / Number(YEAR),
    off: d === 0n ? 0 : Number(((d - pt.numer) * 10_000n) / d) / 100,
  }))
  out.sort((a, b) => (a.start > b.start ? -1 : a.start < b.start ? 1 : 0))
  out.push({ start: 0n, years: 0, off: 0 })
  return out
}

export function tierFor(p: Pricing, duration: bigint): Tier {
  return tiers(p).find((t) => duration >= t.start)!
}

/** exact price in token units, or 0n when the name has no price (too short, empty) */
export function priceFor(p: Pricing, label: string, duration: bigint): bigint {
  if (duration <= 0n) return 0n
  try {
    return priceOf(p, { label, duration })
  } catch {
    return 0n
  }
}

/** the longest term a budget buys, or null when the name has no price */
export function solveBudget(p: Pricing, label: string, budget: bigint): Solution | null {
  try {
    return solve(p, { label, budget })
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------------- money

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b
const cent = (decimals: number) => 10n ** BigInt(decimals) / 100n

/** round a token amount up to the cent */
export const ceilToCent = (amount: bigint, decimals: number) => ceilDiv(amount, cent(decimals)) * cent(decimals)

/** "27.01" → token units; null when it is not a plain decimal amount */
export function parseDollars(text: string, decimals: number): bigint | null {
  const m = text.trim().replace(/^\$/, "").replace(/,/g, "").match(/^(\d*)(?:\.(\d{0,6}))?$/)
  if (!m || (m[1] === "" && !m[2])) return null
  const whole = BigInt(m[1] || "0")
  const frac = BigInt((m[2] ?? "").padEnd(decimals, "0").slice(0, decimals))
  return whole * 10n ** BigInt(decimals) + frac
}

/** token amount to two decimals, nearest: "8.00" */
export function fmtToken(amount: bigint, decimals: number): string {
  const unit = 10n ** BigInt(decimals)
  const cents = (amount * 100n + unit / 2n) / unit
  return `${(cents / 100n).toLocaleString("en-US")}.${(cents % 100n).toString().padStart(2, "0")}`
}

/** "$27.01" from a stablecoin amount */
export const fmtDollars = (amount: bigint, decimals: number) => `$${fmtToken(amount, decimals)}`

/** "6 years", "1 year, 2 months, 3 days", "5 hours", "40 seconds" */
export function fmtDuration(seconds: bigint): string {
  if (seconds <= 0n) return "—"
  if (seconds < DAY) {
    const hours = seconds / 3600n
    const minutes = (seconds % 3600n) / 60n
    if (hours) return `${hours} ${hours === 1n ? "hour" : "hours"}${minutes ? `, ${minutes} min` : ""}`
    if (minutes) return `${minutes} ${minutes === 1n ? "minute" : "minutes"}`
    return `${seconds} seconds`
  }
  const years = seconds / YEAR
  const months = (seconds % YEAR) / MONTH
  const days = ((seconds % YEAR) % MONTH) / DAY
  const parts: string[] = []
  if (years) parts.push(`${years} ${years === 1n ? "year" : "years"}`)
  if (months) parts.push(`${months} ${months === 1n ? "month" : "months"}`)
  if (days) parts.push(`${days} ${days === 1n ? "day" : "days"}`)
  return parts.join(", ")
}

export const yearsToSeconds = (years: number) => BigInt(Math.round(years * Number(YEAR)))

// ---------------------------------------------------------------------------------- the name

export type RenewStatus = "registered" | "grace" | "expired" | "unregistered" | "not-eth"
export type RenewInfo = {
  label: string
  status: RenewStatus
  /** which renewer takes this name, or null when nothing can renew it here */
  renewer: Address | null
  /** on ENSv2 (migrated) or still on ENSv1 */
  v2: boolean
  expiry: bigint | null
  graceEnds: bigint | null
}

export const isEthSecondLevel = (name: string) => /^[^.]+\.eth$/.test(name)

export async function fetchRenewInfo(client: PublicClient, name: string): Promise<RenewInfo> {
  if (!isEthSecondLevel(name)) return { label: name, status: "not-eth", renewer: null, v2: false, expiry: null, graceEnds: null }
  const label = name.slice(0, -4)
  const state = await client.readContract({ address: RENEW.ethRegistry, abi: ethRegistryAbi, functionName: "getState", args: [BigInt(keccak256(toBytes(label)))] })
  const now = BigInt(Math.floor(Date.now() / 1000))
  let renewer: Address | null = null
  let expiry: bigint | null = null
  let graceEnds: bigint | null = null
  let v2 = false
  if (state.status === 2) {
    renewer = RENEW.registrar
    expiry = BigInt(state.expiry)
    graceEnds = expiry + GRACE_V2
    v2 = true
  } else {
    const v1 = await client.readContract({ address: RENEW.baseRegistrarV1, abi: baseRegistrarAbi, functionName: "nameExpires", args: [BigInt(labelhash(label))] })
    if (v1 > 0n && (state.status === 1 || state.latestOwner === "0x0000000000000000000000000000000000000000")) {
      renewer = RENEW.renewerV1
      expiry = v1
      graceEnds = v1 + GRACE_V1
    }
  }
  if (!renewer || !expiry || !graceEnds) return { label, status: "unregistered", renewer: null, v2, expiry: null, graceEnds: null }
  const renewable = await client.readContract({ address: renewer, abi: renewerAbi, functionName: "isRenewable", args: [label] }).catch(() => false)
  if (!renewable) return { label, status: now < graceEnds ? "unregistered" : "expired", renewer: null, v2, expiry, graceEnds }
  return { label, status: now < expiry ? "registered" : "grace", renewer, v2, expiry, graceEnds }
}

// ---------------------------------------------------------------------------------- quotes and calls

/** the longest renewal `budget` buys, confirmed against the contract by ens-budget */
export const quoteBudget = (client: PublicClient, label: string, budget: bigint, token: Address): Promise<Quote> => quoteRenewal(client, { label, budget, token })

/** a fixed term's price from the contract, shaped like a budget quote so the same calls carry it out */
export async function quoteDuration(client: PublicClient, pricing: Pricing, renewer: Address, label: string, duration: bigint, token: Address): Promise<Quote> {
  const amount = await client.readContract({ address: renewer, abi: renewerAbi, functionName: "getRenewPrice", args: [label, duration, token] })
  const t = tierFor(pricing, duration)
  return { label, renewer, token, oracle: pricing.oracle, budget: amount, duration, amount, tier: t.start > 0n ? { duration: t.start, discountBps: Math.round(t.off * 100) } : null, nextTier: null }
}

/** `[approve?, renew]` for a quote: the approval only when the allowance is short, and for the exact amount */
export const renewCalls = (client: PublicClient, quote: Quote, account: Address, referrer: Hex) => prepareRenewal(client, quote, { account, referrer })
