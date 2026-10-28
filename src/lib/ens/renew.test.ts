import { describe, expect, it } from "vitest"
import { type RentPricing, USD_UNITS, YEAR, ceilToCents, durationForBudget, fmtDuration, fmtUsd, fromAmount, nextTierOffer, parseUsd, priceUnits, tierFor, tiers, toAmount } from "./renew"

// the mainnet oracle as read on 2026-10-28
const p: RentPricing = {
  baseRates: [0n, 0n, 20_294_267n, 5_073_567n, 253_679n],
  points: [
    { duration: 2n * YEAR, numer: 87_500_000_000_000_000_000_000_000_000_000_000_000n },
    { duration: 3n * YEAR, numer: 68_750_000_000_000_000_000_000_000_000_000_000_000n },
    { duration: 6n * YEAR, numer: 56_250_000_000_000_000_000_000_000_000_000_000_000n },
  ],
  denom: 100_000_000_000_000_000_000_000_000_000_000_000_000n,
  ratios: { usdc: { numer: 1n, denom: 1_000_000n }, dai: { numer: 1_000_000n, denom: 1n } },
}
const usd = (s: string) => parseUsd(s)!

describe("rent pricing", () => {
  it("prices a year at the headline rates", () => {
    expect(fmtUsd(priceUnits(p, "alice", YEAR))).toBe("$8.00")
    expect(fmtUsd(priceUnits(p, "nick", YEAR))).toBe("$160.00")
    expect(fmtUsd(priceUnits(p, "seg", YEAR))).toBe("$640.00")
    expect(fmtUsd(toAmount(priceUnits(p, "alice", YEAR), p.ratios.usdc) * 1_000_000n)).toBe("$8.00")
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
    const six = durationForBudget(p, "alice", usd("27.01"))!
    expect(six.tier.years).toBe(6)
    expect(six.seconds).toBe(189_285_584n)
    expect(fmtDuration(six.seconds)).toBe("6 years")
    const five = durationForBudget(p, "alice", usd("27.00"))!
    expect(five.tier.years).toBe(3)
    expect(five.seconds).toBeLessThan(6n * YEAR)
    expect(fmtDuration(durationForBudget(p, "alice", usd("8.01"))!.seconds)).toBe("1 year")
    expect(fmtDuration(durationForBudget(p, "alice", usd("8"))!.seconds)).toBe("11 months, 30 days")
    expect(durationForBudget(p, "alice", 0n)!.seconds).toBe(0n)
    expect(durationForBudget(p, "ab", usd("100"))).toBeNull()
  })

  it("never quotes above the budget once rounded to the token", () => {
    for (const dollars of ["8", "13.99", "14", "27", "27.01", "100", "0.37"]) {
      const units = usd(dollars)
      const { seconds } = durationForBudget(p, "alice", units)!
      for (const r of [p.ratios.usdc, p.ratios.dai]) {
        const budget = toAmount(units, r)
        expect(toAmount(priceUnits(p, "alice", seconds), r) <= budget).toBe(true)
        expect(fromAmount(budget, r)).toBe(units)
      }
    }
  })

  it("offers the next tier when it is close", () => {
    const offer = nextTierOffer(p, "alice", usd("25"))!
    expect(offer.tier.years).toBe(6)
    expect(fmtUsd(offer.extraUnits)).toBe("$2.01")
    expect(offer.gainSeconds > YEAR).toBe(true)
    expect(nextTierOffer(p, "alice", usd("8"))).toBeNull()
  })

  it("parses and prints dollars", () => {
    expect(parseUsd("$1,234.5")).toBe(1234n * USD_UNITS + USD_UNITS / 2n)
    expect(parseUsd("abc")).toBeNull()
    expect(parseUsd("")).toBeNull()
    expect(fmtUsd(parseUsd(".5")!)).toBe("$0.50")
    expect(fmtUsd(ceilToCents(priceUnits(p, "alice", 6n * YEAR)))).toBe("$27.01")
    expect(fmtDuration(YEAR + 45n * 86_400n)).toBe("1 year, 1 month, 14 days")
  })
})
