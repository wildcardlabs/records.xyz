import type { Hex } from "viem"
import { decode as chDecode, encode as chEncode, getCodec } from "@ensdomains/content-hash"

/** url scheme ↔ content-hash codec name */
const SCHEMES: Record<string, string> = {
  ipfs: "ipfs",
  ipns: "ipns",
  bzz: "swarm",
  onion: "onion",
  onion3: "onion3",
  sia: "skynet",
  ar: "arweave",
}
const CODEC_TO_SCHEME: Record<string, string> = Object.fromEntries(Object.entries(SCHEMES).map(([s, c]) => [c, s]))

export const CONTENTHASH_SCHEMES = Object.keys(SCHEMES)

/** Parse `scheme://value` into the stored multicodec bytes. Empty string clears. */
export function encodeContenthash(url: string): Hex {
  const t = url.trim()
  if (!t) return "0x"
  const m = /^([a-z0-9]+):\/\/(.+)$/i.exec(t)
  if (!m) throw new Error("use a scheme, e.g. ipfs://… or ar://…")
  const codec = SCHEMES[m[1].toLowerCase()]
  if (!codec) throw new Error(`unsupported scheme ${m[1]}:// (ipfs, ipns, bzz, onion, onion3, sia, ar)`)
  if (codec === "ipns" && m[2].includes(".")) throw new Error("ipns needs a key id (k51… or Qm…), not a domain name")
  try {
    return `0x${chEncode(codec, m[2])}` as Hex
  } catch {
    throw new Error(`not a valid ${m[1]} content id`)
  }
}

/** Stored bytes back to `scheme://value`. Unknown codecs are returned as hex. */
export function decodeContenthash(raw: Hex | string): string {
  if (!raw || raw === "0x") return ""
  const hex = raw.startsWith("0x") ? raw.slice(2) : raw
  try {
    const codec = getCodec(hex)
    const value = chDecode(hex)
    const scheme = CODEC_TO_SCHEME[codec] ?? codec
    return `${scheme}://${value}`
  } catch {
    return raw
  }
}

export function validateContenthash(url: string): string | null {
  if (!url.trim()) return null
  try {
    encodeContenthash(url)
    return null
  } catch (e) {
    return (e as Error).message
  }
}
