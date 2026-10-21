import type { Address } from "viem"

export const shortAddr = (a: string, n = 4) => `${a.slice(0, 2 + n)}…${a.slice(-n)}`

export function fmtDate(unixSeconds: bigint | number): string {
  const d = new Date(Number(unixSeconds) * 1000)
  return d.toISOString().slice(0, 10)
}

export function daysUntil(unixSeconds: bigint | number, now = Date.now()): number {
  return Math.ceil((Number(unixSeconds) * 1000 - now) / 86_400_000)
}

export const nowSeconds = () => BigInt(Math.floor(Date.now() / 1000))

export const sameAddr = (a?: Address | null, b?: Address | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase()
