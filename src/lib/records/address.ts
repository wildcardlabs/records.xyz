import { type Hex, bytesToHex, getAddress, hexToBytes, isAddress, isHex } from "viem"
import { coinNameToTypeMap, coinTypeToNameMap, getCoderByCoinName, getCoderByCoinType } from "@ensdomains/address-encoder"

/** ENSIP-19: the default EVM address every EVM chain falls back to. */
export const COIN_TYPE_DEFAULT = 0x80000000
export const COIN_TYPE_ETH = 60

/** ENSIP-11: coin type for an EVM chain id; mainnet keeps 60. */
export const coinTypeForChain = (chainId: number) => (chainId === 1 ? COIN_TYPE_ETH : (0x80000000 | chainId) >>> 0)
export const isEvmCoinType = (coinType: number) => coinType === COIN_TYPE_ETH || (coinType >= 0x80000000 && coinType <= 0xffffffff)
/** chain id for an EVM coin type; 1 for 60, 0 for the default, null for non-EVM */
export const chainIdForCoinType = (coinType: number): number | null =>
  coinType === COIN_TYPE_ETH ? 1 : coinType === COIN_TYPE_DEFAULT ? 0 : coinType > 0x80000000 && coinType <= 0xffffffff ? coinType - 0x80000000 : null

export type CoinMeta = { coinType: number; name: string; longName: string; evm: boolean; chainId: number | null }

const EXTRA_LONG_NAMES: Record<number, string> = {
  [COIN_TYPE_DEFAULT]: "Default EVM address",
}

/** Human names for a coin type, from the encoder's table or derived for EVM chains it does not list. */
export function coinMeta(coinType: number): CoinMeta {
  const entry = (coinTypeToNameMap as Record<string, readonly [string, string]>)[String(coinType)]
  const chainId = chainIdForCoinType(coinType)
  if (entry) return { coinType, name: entry[0], longName: EXTRA_LONG_NAMES[coinType] ?? entry[1], evm: isEvmCoinType(coinType), chainId }
  if (chainId !== null && chainId > 0) return { coinType, name: `evm:${chainId}`, longName: `EVM chain ${chainId}`, evm: true, chainId }
  return { coinType, name: `coin:${coinType}`, longName: `coin type ${coinType}`, evm: false, chainId: null }
}

export const coinTypeForName = (name: string): number | undefined => (coinNameToTypeMap as Record<string, number>)[name.toLowerCase()]

/** Every coin the encoder knows, for search. */
export function listCoins(): CoinMeta[] {
  return Object.keys(coinTypeToNameMap).map((ct) => coinMeta(Number(ct)))
}

function coder(coinType: number) {
  try {
    return getCoderByCoinType(coinType)
  } catch {
    return undefined
  }
}

/** Encode a user-typed address into the bytes stored onchain (ENSIP-9). Throws with a readable message. */
export function encodeCoinAddress(coinType: number, text: string): Hex {
  const t = text.trim()
  if (!t) return "0x"
  if (isEvmCoinType(coinType)) {
    if (!isAddress(t)) throw new Error("not a valid EVM address")
    return getAddress(t) as Hex
  }
  const c = coder(coinType)
  if (!c) throw new Error(`no encoder for coin type ${coinType}`)
  try {
    return bytesToHex(c.decode(t))
  } catch {
    throw new Error(`not a valid ${coinMeta(coinType).longName} address`)
  }
}

/** Decode stored bytes into the address a user expects to read. */
export function decodeCoinAddress(coinType: number, raw: Hex | string): string {
  if (!raw || raw === "0x") return ""
  if (!isHex(raw)) return raw
  if (isEvmCoinType(coinType)) return isAddress(raw) ? getAddress(raw) : raw
  const c = coder(coinType)
  if (!c) return raw
  try {
    return c.encode(hexToBytes(raw))
  } catch {
    return raw
  }
}

/** null when valid, otherwise the message to show. */
export function validateCoinAddress(coinType: number, text: string): string | null {
  if (!text.trim()) return null
  try {
    encodeCoinAddress(coinType, text)
    return null
  } catch (e) {
    return (e as Error).message
  }
}

export { getCoderByCoinName }
