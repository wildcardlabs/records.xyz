import type { Address, PublicClient } from "viem"
import { isAddressEqual, zeroAddress } from "viem"
import { ACCOUNT_CHAINS } from "./chains"
import { fetchBigName, hasBigName } from "./bigname"

export type Social = { key: string; label: string; value: string; href?: string }
export type ChainAddress = { coinType: number; label: string; address: Address; explorer?: string }
export type Profile = {
  avatar: string | null
  /** url to render for the avatar */
  avatarUrl: string | null
  /** `header` text record: a wide banner image */
  header: string | null
  /** `theme` text record: a colour, used behind the banner area when no header is set */
  theme: string | null
  description: string | null
  url: string | null
  socials: Social[]
  addresses: ChainAddress[]
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
  { key: "email", label: "email", href: (v) => `mailto:${v}` },
]

/** ENSIP-11 coin type for an EVM chain; mainnet keeps 60. */
export const coinTypeFor = (chainId: number) => (chainId === 1 ? 60 : (0x80000000 | chainId) >>> 0)
/** Inverse of coinTypeFor for EVM coin types. */
export const chainIdForCoinType = (coinType: number) => (coinType === 60 ? 1 : coinType >= 0x80000000 ? coinType - 0x80000000 : null)

const CHAIN_LABELS: Record<number, { label: string; explorer: string }> = {
  1: { label: "ethereum", explorer: "https://etherscan.io" },
  8453: { label: "base", explorer: "https://basescan.org" },
  10: { label: "optimism", explorer: "https://optimistic.etherscan.io" },
  42161: { label: "arbitrum", explorer: "https://arbiscan.io" },
  11155111: { label: "sepolia", explorer: "https://sepolia.etherscan.io" },
  84532: { label: "base sepolia", explorer: "https://sepolia.basescan.org" },
  11155420: { label: "op sepolia", explorer: "https://sepolia-optimism.etherscan.io" },
  421614: { label: "arbitrum sepolia", explorer: "https://sepolia.arbiscan.io" },
}

function labelFor(coinType: number, recordsChainId: number): { label: string; explorer?: string } {
  // coin type 60 means "the chain the name lives on": sepolia for a sepolia name
  if (coinType === 60 && recordsChainId === 11155111) return CHAIN_LABELS[11155111]
  const chainId = chainIdForCoinType(coinType)
  if (chainId !== null && CHAIN_LABELS[chainId]) return CHAIN_LABELS[chainId]
  return { label: chainId !== null ? `chain ${chainId}` : `coin ${coinType}` }
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

/** Read the human-facing records of a name: avatar, banner, description, url, socials and per-chain payment addresses. */
export async function fetchProfile(client: PublicClient, name: string, recordsChainId: number): Promise<Profile> {
  if (hasBigName(recordsChainId)) {
    try {
      const bn = await fetchBigName(recordsChainId, name)
      if (bn) {
        const t = (k: string) => bn.texts[k] || null
        const addresses: ChainAddress[] = Object.entries(bn.addresses)
          .map(([ct, a]) => ({ coinType: Number(ct), a }))
          .filter(({ a }) => /^0x[0-9a-fA-F]{40}$/.test(a) && !isAddressEqual(a as Address, zeroAddress))
          .sort((x, y) => x.coinType - y.coinType)
          .map(({ coinType, a }) => ({ coinType, address: a as Address, ...labelFor(coinType, recordsChainId) }))
        return {
          avatar: t("avatar"),
          avatarUrl: avatarUrlFor(t("avatar"), name, recordsChainId),
          header: t("header"),
          theme: t("theme"),
          description: t("description"),
          url: t("url"),
          socials: socialsFrom(t),
          addresses,
          source: "bigname",
          asOfBlock: bn.asOfBlock,
        }
      }
    } catch {
      /* indexer unavailable: fall back to chain reads */
    }
  }

  const text = (key: string) => client.getEnsText({ name, key }).catch(() => null)
  const addr = (coinType: number) => client.getEnsAddress({ name, coinType: BigInt(coinType) }).catch(() => null)
  const chains = recordsChainId === 11155111 ? ACCOUNT_CHAINS.filter((c) => c.chain.id === 11155111) : ACCOUNT_CHAINS.filter((c) => c.chain.id !== 11155111)

  const [avatar, header, theme, description, url, socialValues, addressValues] = await Promise.all([
    text("avatar"),
    text("header"),
    text("theme"),
    text("description"),
    text("url"),
    Promise.all(SOCIAL_KEYS.map((s) => text(s.key))),
    Promise.all(chains.map((c) => addr(recordsChainId === 11155111 ? 60 : coinTypeFor(c.chain.id)))),
  ])
  const socialMap = Object.fromEntries(SOCIAL_KEYS.map((s, i) => [s.key, socialValues[i]]))
  const addresses: ChainAddress[] = chains.flatMap((c, i) => {
    const a = addressValues[i]
    if (!a || isAddressEqual(a as Address, zeroAddress)) return []
    const coinType = recordsChainId === 11155111 ? 60 : coinTypeFor(c.chain.id)
    return [{ coinType, address: a as Address, label: c.label, explorer: c.explorer }]
  })

  return {
    avatar: avatar || null,
    avatarUrl: avatarUrlFor(avatar || null, name, recordsChainId),
    header: header || null,
    theme: theme || null,
    description: description || null,
    url: url || null,
    socials: socialsFrom((k) => socialMap[k]),
    addresses,
    source: "chain",
  }
}
