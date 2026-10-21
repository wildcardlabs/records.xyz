import { type Address, type Hex, decodeAbiParameters, encodeAbiParameters, getAddress, isHex, size, slice } from "viem"

/** Listing value: abi.encode(address a1, address a2, ...) — one 32-byte word per account, order free. */
export function encodeListing(accounts: readonly Address[]): Hex {
  if (accounts.length === 0) return "0x"
  return encodeAbiParameters(
    accounts.map(() => ({ type: "address" as const })),
    accounts.map((a) => getAddress(a))
  )
}

/**
 * Decode a listing. Returns null when the value is not a whole number of 32-byte words,
 * or when a word carries bits above the low 20 bytes.
 */
export function decodeListing(value: Hex | undefined | null): Address[] | null {
  if (!value || value === "0x") return []
  if (!isHex(value)) return null
  const len = size(value)
  if (len % 32 !== 0) return null
  const out: Address[] = []
  for (let i = 0; i < len; i += 32) {
    const word = slice(value, i, i + 32)
    const high = slice(word, 0, 12)
    if (high !== "0x000000000000000000000000") return null
    out.push(getAddress(slice(word, 12, 32)))
  }
  return out
}

/** Proof value: abi.encode(uint256 expiresAt, bytes signature). */
export function encodeProof(expiresAt: bigint, signature: Hex): Hex {
  return encodeAbiParameters([{ type: "uint256" }, { type: "bytes" }], [expiresAt, signature])
}

export function decodeProof(value: Hex | undefined | null): { expiresAt: bigint; signature: Hex } | null {
  if (!value || value === "0x" || !isHex(value)) return null
  try {
    const [expiresAt, signature] = decodeAbiParameters([{ type: "uint256" }, { type: "bytes" }], value)
    return { expiresAt, signature }
  } catch {
    return null
  }
}

/** `accounts-chains` value: abi.encode(uint256 c1, uint256 c2, ...). */
export function encodeChains(chainIds: readonly number[]): Hex {
  if (chainIds.length === 0) return "0x"
  return encodeAbiParameters(
    chainIds.map(() => ({ type: "uint256" as const })),
    chainIds.map((c) => BigInt(c))
  )
}

export function decodeChains(value: Hex | undefined | null): number[] | null {
  if (!value || value === "0x") return []
  if (!isHex(value)) return null
  const len = size(value)
  if (len % 32 !== 0) return null
  const out: number[] = []
  for (let i = 0; i < len; i += 32) {
    const word = BigInt(slice(value, i, i + 32))
    if (word > BigInt(Number.MAX_SAFE_INTEGER)) return null
    out.push(Number(word))
  }
  return out
}
