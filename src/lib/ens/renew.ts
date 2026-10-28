import { type Address, type PublicClient, keccak256, labelhash, toBytes } from "viem"

/**
 * Renewing .eth names on mainnet ENSv2.
 *
 * Two renewers share one interface and one price oracle:
 *  - ETHRegistrar renews names migrated to ENSv2 (REGISTERED in the .eth registry);
 *  - ETHRenewerV1 renews names still on ENSv1 (RESERVED in the .eth registry) and syncs
 *    the v1 registrar, so the name's v1 expiry moves too.
 * Both take an ERC20 (USDC or DAI) and need an approval first. Anyone can renew any name.
 */
export const RENEW = {
  registrar: "0xd6d8369e55c94ae8afa714e6cf7ab5be54d5cc81",
  renewerV1: "0x56c447f308f463a01121c41e72b0e7e7557fcb68",
  ethRegistry: "0xf60aba43e1f7f3dab1186ff03b561401c9df85e2",
  oracle: "0x76f29609a363a8a1a2a6abe2e859c0f8916af469",
  baseRegistrarV1: "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85",
} as const satisfies Record<string, Address>

export type PayToken = { symbol: "USDC" | "DAI"; address: Address; decimals: number }
export const PAY_TOKENS: PayToken[] = [
  { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
]

export const YEAR = 31_536_000n
const MONTH = YEAR / 12n
const DAY = 86_400n
/** ENSv2 grace period (28 days); the v1 renewer adds the 62-day premigration bonus on top. */
export const GRACE_V2 = 28n * DAY
export const GRACE_V1 = 90n * DAY
/** the oracle prices in "standard units"; the USDC ratio makes one dollar 1e12 of them */
export const USD_UNITS = 10n ** 12n

export const renewerAbi = [
  {
    type: "function",
    name: "renew",
    stateMutability: "nonpayable",
    inputs: [
      { name: "rd", type: "tuple", components: [{ name: "label", type: "string" }, { name: "duration", type: "uint64" }, { name: "referrer", type: "bytes32" }] },
      { name: "paymentToken", type: "address" },
    ],
    outputs: [],
  },
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

const oracleAbi = [
  { type: "function", name: "getBaseRates", stateMutability: "view", inputs: [], outputs: [{ type: "uint256[]" }] },
  { type: "function", name: "getDiscountPoints", stateMutability: "view", inputs: [], outputs: [{ type: "tuple[]", components: [{ name: "duration", type: "uint64" }, { name: "numer", type: "uint128" }] }] },
  { type: "function", name: "DISCOUNT_DENOMINATOR", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getPaymentTokenRatio", stateMutability: "view", inputs: [{ name: "paymentToken", type: "address" }], outputs: [{ name: "numer", type: "uint128" }, { name: "denom", type: "uint128" }] },
] as const

// ---------------------------------------------------------------------------------- pricing

export type Ratio = { numer: bigint; denom: bigint }
export type RentPricing = {
  /** per-second price in standard units, indexed by codepoint count minus one; longer names use the last */
  baseRates: bigint[]
  /** discount thresholds, ascending; `numer / denom` is the fraction of the price you pay */
  points: { duration: bigint; numer: bigint }[]
  denom: bigint
  /** token ratios by lowercase address */
  ratios: Record<string, Ratio>
}

export async function fetchRentPricing(client: PublicClient): Promise<RentPricing> {
  const [baseRates, points, denom, ...ratios] = await Promise.all([
    client.readContract({ address: RENEW.oracle, abi: oracleAbi, functionName: "getBaseRates" }),
    client.readContract({ address: RENEW.oracle, abi: oracleAbi, functionName: "getDiscountPoints" }),
    client.readContract({ address: RENEW.oracle, abi: oracleAbi, functionName: "DISCOUNT_DENOMINATOR" }),
    ...PAY_TOKENS.map((t) => client.readContract({ address: RENEW.oracle, abi: oracleAbi, functionName: "getPaymentTokenRatio", args: [t.address] })),
  ])
  return {
    baseRates: [...baseRates],
    points: points.map((p) => ({ duration: BigInt(p.duration), numer: BigInt(p.numer) })),
    denom,
    ratios: Object.fromEntries(PAY_TOKENS.map((t, i) => [t.address.toLowerCase(), { numer: BigInt(ratios[i][0]), denom: BigInt(ratios[i][1]) }])),
  }
}

/** codepoints, as the oracle counts them */
export const labelLength = (label: string) => [...label].length

/** per-second price in standard units, or 0n when the oracle has no price for this length */
export function baseRate(p: RentPricing, label: string): bigint {
  const n = labelLength(label)
  if (n === 0 || p.baseRates.length === 0) return 0n
  return p.baseRates[Math.min(n, p.baseRates.length) - 1] ?? 0n
}

export type Tier = { start: bigint; numer: bigint; years: number; off: number }

/** every discount tier, best first, ending with the undiscounted base tier */
export function tiers(p: RentPricing): Tier[] {
  const out = p.points.map((pt) => ({
    start: pt.duration,
    numer: pt.numer,
    years: pt.duration % YEAR === 0n ? Number(pt.duration / YEAR) : Number(pt.duration) / Number(YEAR),
    off: 100 - Number((pt.numer * 10_000n) / p.denom) / 100,
  }))
  out.sort((a, b) => (a.start > b.start ? -1 : a.start < b.start ? 1 : 0))
  out.push({ start: 0n, numer: p.denom, years: 0, off: 0 })
  return out
}

export function tierFor(p: RentPricing, duration: bigint): Tier {
  return tiers(p).find((t) => duration >= t.start)!
}

/** the oracle's price for `duration` seconds, in standard units (floor, as mulDiv does) */
export function priceUnits(p: RentPricing, label: string, duration: bigint): bigint {
  const base = baseRate(p, label)
  if (base === 0n || duration <= 0n) return 0n
  const t = tierFor(p, duration)
  return (base * duration * t.numer) / p.denom
}

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b

/** standard units to token amount, rounding up as the oracle does */
export const toAmount = (units: bigint, r: Ratio) => (r.numer === r.denom ? units : ceilDiv(units * r.numer, r.denom))
/** token amount to standard units (floor) */
export const fromAmount = (amount: bigint, r: Ratio) => (r.numer === r.denom ? amount : (amount * r.denom) / r.numer)

/**
 * The longest duration `units` buys: the best tier whose entry price fits, then the most
 * seconds at that tier's rate whose floored price still fits. Null when the name has no price.
 */
export function durationForBudget(p: RentPricing, label: string, units: bigint): { seconds: bigint; tier: Tier } | null {
  const base = baseRate(p, label)
  if (base === 0n) return null
  for (const tier of tiers(p)) {
    if (units < priceUnits(p, label, tier.start)) continue
    const seconds = ((units + 1n) * p.denom - 1n) / (base * tier.numer)
    return { seconds, tier }
  }
  return null
}

/** the next tier up when it is within reach: what it costs, how much more that is, and how much longer it buys */
export function nextTierOffer(p: RentPricing, label: string, units: bigint, within = 0.35): { tier: Tier; costUnits: bigint; extraUnits: bigint; gainSeconds: bigint } | null {
  const now = durationForBudget(p, label, units)
  if (!now || units <= 0n) return null
  const above = tiers(p)
    .filter((t) => t.start > 0n && priceUnits(p, label, t.start) > units)
    .sort((a, b) => (a.start < b.start ? -1 : 1))[0]
  if (!above) return null
  const costUnits = ceilToCents(priceUnits(p, label, above.start))
  const extraUnits = costUnits - units
  if (Number(extraUnits) > Number(units) * within) return null
  const then = durationForBudget(p, label, costUnits)
  if (!then || then.seconds <= now.seconds) return null
  return { tier: above, costUnits, extraUnits, gainSeconds: then.seconds - now.seconds }
}

// ---------------------------------------------------------------------------------- formatting

const CENT = USD_UNITS / 100n
export const ceilToCents = (units: bigint) => ceilDiv(units, CENT) * CENT

/** "$27.01" from standard units, to the nearest cent */
export function fmtUsd(units: bigint): string {
  const cents = (units + CENT / 2n) / CENT
  const d = cents / 100n
  const c = (cents % 100n).toString().padStart(2, "0")
  return `$${d.toLocaleString("en-US")}.${c}`
}

/** "27.01" → standard units; null when it is not a plain decimal amount */
export function parseUsd(text: string): bigint | null {
  const m = text.trim().replace(/^\$/, "").replace(/,/g, "").match(/^(\d*)(?:\.(\d{0,6}))?$/)
  if (!m || (m[1] === "" && !m[2])) return null
  const whole = BigInt(m[1] || "0")
  const frac = BigInt((m[2] ?? "").padEnd(12, "0").slice(0, 12))
  return whole * USD_UNITS + frac
}

/** token amount to two decimals, nearest: "8.00" */
export function fmtToken(amount: bigint, decimals: number): string {
  const unit = 10n ** BigInt(decimals)
  const cents = (amount * 100n + unit / 2n) / unit
  return `${(cents / 100n).toLocaleString("en-US")}.${(cents % 100n).toString().padStart(2, "0")}`
}

/** "6 years", "1 year, 2 months, 3 days" — nothing under a day */
export function fmtDuration(seconds: bigint): string {
  if (seconds < DAY) return "—"
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

/** the contract's price for `seconds`; the single source of truth before paying */
export function quoteRenew(client: PublicClient, renewer: Address, label: string, seconds: bigint, token: Address): Promise<bigint> {
  return client.readContract({ address: renewer, abi: renewerAbi, functionName: "getRenewPrice", args: [label, seconds, token] })
}

/**
 * Trim `seconds` until the contract's price fits `maxAmount`, so a budget never overshoots by
 * a rounding unit. Normally the first quote already fits.
 */
export async function quoteWithinBudget(client: PublicClient, renewer: Address, label: string, seconds: bigint, token: Address, maxAmount: bigint): Promise<{ seconds: bigint; amount: bigint }> {
  let s = seconds
  for (let i = 0; i < 4 && s > 0n; i++) {
    const amount = await quoteRenew(client, renewer, label, s, token)
    if (amount <= maxAmount) return { seconds: s, amount }
    s -= ceilDiv((amount - maxAmount) * s, amount) + 1n
  }
  return { seconds: 0n, amount: 0n }
}
