import type { Address } from "viem"
import { isAddressEqual, zeroAddress } from "viem"
import type { RecordSet } from "./recordset"
import { COIN_TYPE_DEFAULT, COIN_TYPE_ETH, type RecordDef, addressDef, chainIdForCoinType, coinMeta, coinTypeForChain, coinTypeForName, contenthashDef, decodeValue, isEvmCoinType, textDef } from "@/lib/records"

export type Social = { key: string; label: string; value: string; href?: string }
export type ChainAddress = {
  coinType: number
  label: string
  /** the ENSIP-19 default: what every EVM chain without its own address resolves to */
  isDefault: boolean
  /** decoded, display form: checksummed for EVM chains, native encoding for other coins */
  address: string
  evm: boolean
  explorer?: string
}
export type Profile = {
  /** `name` text record, shown above the ENS name when set */
  displayName: string | null
  avatar: string | null
  /** url to render for the avatar */
  avatarUrl: string | null
  /** `header` text record: a wide banner image */
  header: string | null
  /** `theme` text record: a colour, used behind the banner area when no header is set */
  theme: string | null
  description: string | null
  location: string | null
  url: string | null
  /** decoded content hash (ipfs://…, ar://…, ton://…) */
  contenthash: string | null
  socials: Social[]
  addresses: ChainAddress[]
  /** featured EVM chains that have no address of their own and so resolve to the default (empty when no default is set) */
  fallbackChains: string[]
  /** where the data came from */
  source: "chain" | "bigname"
  asOfBlock?: number | null
}

const SOCIAL_KEYS: { key: string; label: string; href: (v: string) => string | undefined }[] = [
  { key: "com.twitter", label: "x", href: (v) => `https://x.com/${v.replace(/^@/, "")}` },
  { key: "com.github", label: "github", href: (v) => `https://github.com/${v.replace(/^@/, "")}` },
  { key: "xyz.farcaster", label: "farcaster", href: (v) => `https://warpcast.com/${v.replace(/^@/, "")}` },
  { key: "org.telegram", label: "telegram", href: (v) => `https://t.me/${v.replace(/^@/, "")}` },
  { key: "com.discord", label: "discord", href: () => undefined },
  { key: "com.linkedin", label: "linkedin", href: (v) => `https://www.linkedin.com/in/${v.replace(/^@/, "")}` },
  { key: "com.reddit", label: "reddit", href: (v) => `https://www.reddit.com/user/${v.replace(/^(u\/|@)/, "")}` },
  { key: "email", label: "email", href: (v) => `mailto:${v}` },
]

/** ENSIP-11 coin type for an EVM chain; mainnet keeps 60. */
export const coinTypeFor = coinTypeForChain
export { chainIdForCoinType }

const CHAIN_LABELS: Record<number, { label: string; explorer: string }> = {
  1: { label: "ethereum", explorer: "https://etherscan.io" },
  8453: { label: "base", explorer: "https://basescan.org" },
  10: { label: "optimism", explorer: "https://optimistic.etherscan.io" },
  42161: { label: "arbitrum", explorer: "https://arbiscan.io" },
  137: { label: "polygon", explorer: "https://polygonscan.com" },
  59144: { label: "linea", explorer: "https://lineascan.build" },
  534352: { label: "scroll", explorer: "https://scrollscan.com" },
  42220: { label: "celo", explorer: "https://celoscan.io" },
  11155111: { label: "sepolia", explorer: "https://sepolia.etherscan.io" },
  84532: { label: "base sepolia", explorer: "https://sepolia.basescan.org" },
  11155420: { label: "op sepolia", explorer: "https://sepolia-optimism.etherscan.io" },
  421614: { label: "arbitrum sepolia", explorer: "https://sepolia.arbiscan.io" },
}

const COIN_EXPLORERS: Record<string, string> = {
  btc: "https://mempool.space",
  sol: "https://solscan.io",
}

/**
 * How to name an address record for people: the chain for EVM coin types (coin 60 is "the chain
 * the name lives on", so sepolia for a sepolia name), the coin for everything else.
 */
export function addressLabel(coinType: number, recordsChainId: number): { label: string; longName: string; explorer?: string } {
  if (coinType === COIN_TYPE_ETH && recordsChainId === 11155111) return { ...CHAIN_LABELS[11155111], longName: "Sepolia" }
  if (coinType === COIN_TYPE_DEFAULT) return { label: "any evm chain", longName: "default address" }
  const chainId = chainIdForCoinType(coinType)
  if (chainId !== null && CHAIN_LABELS[chainId]) return { ...CHAIN_LABELS[chainId], longName: CHAIN_LABELS[chainId].label }
  const m = coinMeta(coinType)
  if (m.evm) return { label: `chain ${chainId}`, longName: `EVM chain ${chainId}` }
  return { label: m.name, longName: m.longName, explorer: COIN_EXPLORERS[m.name] }
}

/** The address records offered up front for a records chain: its own chain first, then the usual suspects. */
export function featuredAddressDefs(recordsChainId: number): RecordDef[] {
  const coins =
    recordsChainId === 11155111
      ? [COIN_TYPE_DEFAULT, COIN_TYPE_ETH, coinTypeForChain(84532), coinTypeForChain(11155420), coinTypeForChain(421614)]
      : [COIN_TYPE_DEFAULT, COIN_TYPE_ETH, coinTypeForChain(8453), coinTypeForChain(10), coinTypeForChain(42161), ...["btc", "sol"].map(coinTypeForName).filter((c): c is number => c !== undefined)]
  return coins.map((c) => withLabel(addressDef(c), recordsChainId))
}

/** An address def relabelled for the records chain it is shown on. */
export function withLabel(def: RecordDef, recordsChainId: number): RecordDef {
  if (def.kind !== "address") return def
  const l = addressLabel(def.arg as number, recordsChainId)
  return { ...def, label: l.label, longName: l.longName }
}

const isHttp = (v: string) => /^https?:\/\//i.test(v)
const metadataNet = (chainId: number) => (chainId === 11155111 ? "sepolia" : "mainnet")

function avatarUrlFor(avatar: string | null, name: string, recordsChainId: number): string | null {
  if (!avatar) return null
  if (isHttp(avatar)) return avatar
  return `https://metadata.ens.domains/${metadataNet(recordsChainId)}/avatar/${name}`
}

function socialsFrom(get: (key: string) => string | null | undefined): Social[] {
  return SOCIAL_KEYS.flatMap((s) => {
    const v = get(s.key)
    return v ? [{ key: s.key, label: s.label, value: v, href: s.href(v) }] : []
  })
}

const isEmpty = (v: string | undefined) => !v || v === "0x" || v === zeroAddress

/** Build the display Profile from a record set, so the card does not care where values came from. */
export function profileFromRecordSet(set: RecordSet, name: string, recordsChainId: number): Profile {
  const text = (k: string) => set.values[textDef(k).id] || null
  const addresses: ChainAddress[] = Object.entries(set.values)
    .filter(([id, raw]) => id.startsWith("address:") && !isEmpty(raw))
    .map(([id, raw]) => ({ coinType: Number(id.slice(8)), raw }))
    .filter(({ coinType, raw }) => !isEvmCoinType(coinType) || (/^0x[0-9a-fA-F]{40}$/.test(raw) && !isAddressEqual(raw as Address, zeroAddress)))
    .sort((x, y) => rank(x.coinType) - rank(y.coinType) || x.coinType - y.coinType)
    .map(({ coinType, raw }) => {
      const l = addressLabel(coinType, recordsChainId)
      return { coinType, label: l.label, isDefault: coinType === COIN_TYPE_DEFAULT, address: decodeValue(addressDef(coinType), raw), evm: isEvmCoinType(coinType), explorer: l.explorer }
    })
  const hasDefault = addresses.some((a) => a.isDefault)
  const fallbackChains = hasDefault
    ? featuredAddressDefs(recordsChainId)
        .filter((d) => d.arg !== COIN_TYPE_DEFAULT && d.arg !== COIN_TYPE_ETH && isEvmCoinType(d.arg as number) && !addresses.some((a) => a.coinType === d.arg))
        .map((d) => d.label)
    : []
  const ch = set.values[contenthashDef.id]
  return {
    displayName: text("name"),
    avatar: text("avatar"),
    avatarUrl: avatarUrlFor(text("avatar"), name, recordsChainId),
    header: text("header"),
    theme: text("theme"),
    description: text("description"),
    location: text("location"),
    url: text("url"),
    contenthash: ch && ch !== "0x" ? decodeValue(contenthashDef, ch) || null : null,
    socials: socialsFrom(text),
    addresses,
    fallbackChains,
    source: set.source,
    asOfBlock: set.asOfBlock,
  }
}

/** the default first (it covers every EVM chain), then the name's own chain, then other EVM chains, then other coins */
function rank(coinType: number) {
  if (coinType === COIN_TYPE_DEFAULT) return 0
  if (coinType === COIN_TYPE_ETH) return 1
  return isEvmCoinType(coinType) ? 2 : 3
}
