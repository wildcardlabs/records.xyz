import type { Address, PublicClient } from "viem"
import { isAddressEqual, zeroAddress } from "viem"
import { ACCOUNT_CHAINS } from "./chains"

export type Social = { key: string; label: string; value: string; href?: string }
export type ChainAddress = { chainId: number; label: string; coinType: number; address: Address; explorer?: string }
export type Profile = {
  avatar: string | null
  /** url to render for the avatar (ENS metadata service resolves eip155 and ipfs avatars) */
  avatarUrl: string | null
  description: string | null
  url: string | null
  socials: Social[]
  addresses: ChainAddress[]
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

const metadataNet = (chainId: number) => (chainId === 11155111 ? "sepolia" : "mainnet")

/** Read the human-facing records of a name: avatar, description, url, socials and per-chain payment addresses. */
export async function fetchProfile(client: PublicClient, name: string, recordsChainId: number): Promise<Profile> {
  const text = (key: string) => client.getEnsText({ name, key }).catch(() => null)
  const addr = (coinType: number) => client.getEnsAddress({ name, coinType: BigInt(coinType) }).catch(() => null)

  // on a testnet, only the records chain itself is meaningful for payments
  const chains = recordsChainId === 11155111 ? ACCOUNT_CHAINS.filter((c) => c.chain.id === 11155111) : ACCOUNT_CHAINS.filter((c) => c.chain.id !== 11155111)

  const [avatar, description, url, socialValues, addressValues] = await Promise.all([
    text("avatar"),
    text("description"),
    text("url"),
    Promise.all(SOCIAL_KEYS.map((s) => text(s.key))),
    Promise.all(chains.map((c) => addr(recordsChainId === 11155111 ? 60 : coinTypeFor(c.chain.id)))),
  ])

  const socials: Social[] = SOCIAL_KEYS.flatMap((s, i) => {
    const v = socialValues[i]
    return v ? [{ key: s.key, label: s.label, value: v, href: s.href(v) }] : []
  })

  const addresses: ChainAddress[] = chains.flatMap((c, i) => {
    const a = addressValues[i]
    if (!a || isAddressEqual(a as Address, zeroAddress)) return []
    return [{ chainId: c.chain.id, label: c.label, coinType: coinTypeFor(c.chain.id), address: a as Address, explorer: c.explorer }]
  })

  return {
    avatar: avatar || null,
    avatarUrl: avatar ? `https://metadata.ens.domains/${metadataNet(recordsChainId)}/avatar/${name}` : null,
    description: description || null,
    url: url || null,
    socials,
    addresses,
  }
}
