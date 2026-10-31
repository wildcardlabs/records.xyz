import { describe, expect, it } from "vitest"
import { type Pricing, YEAR, ceilToCent, fmtDollars, fmtDuration, fmtToken, parseDollars, priceFor, solveBudget, tierFor, tiers } from "./renew"

// the mainnet oracle as read on 2026-10-28, priced in USDC (6 decimals)
const p: Pricing = {
  oracle: "0x76f29609a363a8a1a2a6abe2e859c0f8916af469",
  token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  baseRates: [0n, 0n, 20_294_267n, 5_073_567n, 253_679n],
  discountPoints: [
    { duration: 2n * YEAR, numer: 87_500_000_000_000_000_000_000_000_000_000_000_000n },
    { duration: 3n * YEAR, numer: 68_750_000_000_000_000_000_000_000_000_000_000_000n },
    { duration: 6n * YEAR, numer: 56_250_000_000_000_000_000_000_000_000_000_000_000n },
  ],
  discountDenominator: 100_000_000_000_000_000_000_000_000_000_000_000_000n,
  tokenRatio: { numer: 1n, denom: 1_000_000n },
}
const usdc = (s: string) => parseDollars(s, 6)!

describe("renewals through ens-budget", () => {
  it("prices a year at the headline rates", () => {
    expect(fmtDollars(priceFor(p, "alice", YEAR), 6)).toBe("$8.00")
    expect(fmtDollars(priceFor(p, "nick", YEAR), 6)).toBe("$160.00")
    expect(fmtDollars(priceFor(p, "seg", YEAR), 6)).toBe("$640.00")
    expect(priceFor(p, "ab", YEAR)).toBe(0n)
  })

  it("lists the tiers best first with their discounts", () => {
    expect(tiers(p).map((t) => [t.years, t.off])).toEqual([
      [6, 43.75],
      [3, 31.25],
      [2, 12.5],
      [0, 0],
    ])
    expect(tierFor(p, 5n * YEAR).years).toBe(3)
    expect(tierFor(p, YEAR + 1n).years).toBe(0)
  })

  it("turns a budget into the longest term it buys", () => {
    // the six-year sweet spot: $27.01 buys six years, $27.00 does not reach the tier
    const six = solveBudget(p, "alice", usd("27.01"))!
    expect(six.duration).toBe(189_285_584n)
    expect(six.tier?.discountBps).toBe(4375)
    expect(fmtDuration(six.duration)).toBe("6 years")
    const five = solveBudget(p, "alice", usd("27.00"))!
    expect(five.tier?.discountBps).toBe(3125)
    expect(five.nextTier?.discountBps).toBe(4375)
    expect(fmtDollars(five.nextTier!.extraAmount, 6)).toBe("$0.00")
    expect(fmtDollars(ceilToCent(five.nextTier!.amount, 6), 6)).toBe("$27.01")
    expect(fmtDuration(solveBudget(p, "alice", usd("8.01"))!.duration)).toBe("1 year")
    expect(solveBudget(p, "ab", usd("100"))).toBeNull()
  })

  it("never quotes above the budget", () => {
    for (const dollars of ["8", "13.99", "14", "27", "27.01", "100", "0.37"]) {
      const budget = usd(dollars)
      const { duration, amount } = solveBudget(p, "alice", budget)!
      expect(amount <= budget).toBe(true)
      expect(priceFor(p, "alice", duration)).toBe(amount)
      if (duration > 0n) expect(priceFor(p, "alice", duration + 1n) > budget).toBe(true)
    }
  })

  it("parses and prints dollars", () => {
    expect(parseDollars("$1,234.5", 6)).toBe(1_234_500_000n)
    expect(parseDollars("27.01", 18)).toBe(27_010_000_000_000_000_000n)
    expect(parseDollars("abc", 6)).toBeNull()
    expect(parseDollars("", 6)).toBeNull()
    expect(fmtToken(8_000_022n, 6)).toBe("8.00")
    expect(fmtDuration(YEAR + 45n * 86_400n)).toBe("1 year, 1 month, 14 days")
  })
})

const usd = usdc
