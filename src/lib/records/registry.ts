import { type Hex, isHex } from "viem"
import type { RecordDef, RecordKind, Section } from "./types"
import { COIN_TYPE_DEFAULT, COIN_TYPE_ETH, coinMeta, coinTypeForName, decodeCoinAddress, encodeCoinAddress, listCoins, validateCoinAddress } from "./address"
import { decodeContenthash, encodeContenthash, validateContenthash } from "./contenthash"
import { validateEmail, validateHandle, validateImageUrl, validateText, validateTimezone, validateUrl } from "./validate"

export const SECTIONS: { id: Section; label: string; hint: string }[] = [
  { id: "profile", label: "profile", hint: "who this name is" },
  { id: "links", label: "links", hint: "where to find you" },
  { id: "addresses", label: "payment addresses", hint: "where to pay this name, per chain and coin" },
  { id: "website", label: "website", hint: "decentralised content behind the name" },
  { id: "advanced", label: "advanced", hint: "records most people never need" },
  { id: "owned", label: "owned accounts", hint: "wallets this name has proven are its own" },
]

type TextSpec = { key: string; label: string; section: Section; placeholder?: string; hint?: string; featured?: boolean; validate?: (v: string) => string | null }

/** Text records the editor knows by name. Anything else is reachable as a custom key. */
export const TEXT_SPECS: TextSpec[] = [
  { key: "name", label: "display name", section: "profile", placeholder: "Alice", featured: true },
  { key: "description", label: "description", section: "profile", placeholder: "one line about you", featured: true },
  { key: "avatar", label: "avatar", section: "profile", placeholder: "https://… or eip155:1/erc721:0x…/123", featured: true, validate: validateImageUrl },
  { key: "header", label: "banner", section: "profile", placeholder: "https://… (wide image)", featured: true, validate: validateImageUrl },
  { key: "location", label: "location", section: "profile", placeholder: "Lisbon" },
  { key: "timezone", label: "timezone", section: "profile", placeholder: "Europe/Lisbon", validate: validateTimezone },
  { key: "keywords", label: "keywords", section: "profile", placeholder: "design, ethereum" },
  { key: "notice", label: "notice", section: "profile", placeholder: "a note shown with the name" },
  { key: "url", label: "website", section: "links", placeholder: "https://…", featured: true, validate: validateUrl },
  { key: "email", label: "email", section: "links", placeholder: "you@example.com", validate: validateEmail },
  { key: "com.twitter", label: "x", section: "links", placeholder: "handle", featured: true, validate: validateHandle },
  { key: "com.github", label: "github", section: "links", placeholder: "username", featured: true, validate: validateHandle },
  { key: "xyz.farcaster", label: "farcaster", section: "links", placeholder: "username", validate: validateHandle },
  { key: "org.telegram", label: "telegram", section: "links", placeholder: "username", validate: validateHandle },
  { key: "com.discord", label: "discord", section: "links", placeholder: "username", validate: validateHandle },
  { key: "com.linkedin", label: "linkedin", section: "links", placeholder: "profile name", validate: validateHandle },
  { key: "com.reddit", label: "reddit", section: "links", placeholder: "username", validate: validateHandle },
]

/** Coins the editor shows up front; every other coin the encoder knows is reachable through search. */
export const FEATURED_COINS = ["default", "eth", "btc", "sol", "base", "op", "arb1", "matic", "linea", "scr", "celo"]

export const recordId = (kind: RecordKind, arg?: string | number) => (arg === undefined ? kind : `${kind}:${arg}`)

export function textDef(key: string): RecordDef {
  const spec = TEXT_SPECS.find((s) => s.key === key)
  return {
    id: recordId("text", key),
    kind: "text",
    arg: key,
    label: spec?.label ?? key,
    longName: spec ? key : undefined,
    section: spec?.section ?? "advanced",
    placeholder: spec?.placeholder,
    hint: spec?.hint,
    featured: spec?.featured,
  }
}

export function addressDef(coinType: number): RecordDef {
  const m = coinMeta(coinType)
  return {
    id: recordId("address", coinType),
    kind: "address",
    arg: coinType,
    label: coinType === COIN_TYPE_DEFAULT ? "default (any EVM chain)" : m.name,
    longName: m.longName,
    section: "addresses",
    placeholder: m.evm ? "0x…" : `${m.longName} address`,
    hint: coinType === COIN_TYPE_DEFAULT ? "EVM chains without their own address fall back to this one (ENSIP-19)" : undefined,
    chainId: m.chainId ?? undefined,
    coin: m.name,
    featured: FEATURED_COINS.includes(m.name),
  }
}

export const contenthashDef: RecordDef = {
  id: "contenthash",
  kind: "contenthash",
  label: "content",
  longName: "content hash",
  section: "website",
  placeholder: "ipfs://… · ipns://… · ar://… · bzz://… · onion://… · ton://…",
  hint: "what loads at this name in an ENS-aware browser or gateway",
  featured: true,
}

export function abiDef(contentType = 1): RecordDef {
  return { id: recordId("abi", contentType), kind: "abi", arg: contentType, label: `abi (type ${contentType})`, longName: "contract ABI", section: "advanced", placeholder: "0x… or JSON" }
}

export function interfaceDef(interfaceId: string): RecordDef {
  return { id: recordId("interface", interfaceId), kind: "interface", arg: interfaceId, label: `interface ${interfaceId}`, longName: "interface implementer", section: "advanced", placeholder: "0x…" }
}

export function dataDef(key: string): RecordDef {
  return { id: recordId("data", key), kind: "data", arg: key, label: key, longName: "data record", section: key.startsWith("accounts") ? "owned" : "advanced", placeholder: "0x…" }
}

/** Parse an id back into a definition. */
export function defFromId(id: string): RecordDef | null {
  const [kind, ...rest] = id.split(":")
  const arg = rest.join(":")
  switch (kind as RecordKind) {
    case "text":
      return textDef(arg)
    case "address":
      return addressDef(Number(arg))
    case "contenthash":
      return contenthashDef
    case "abi":
      return abiDef(Number(arg || 1))
    case "interface":
      return interfaceDef(arg)
    case "data":
      return dataDef(arg)
    default:
      return null
  }
}

/** The records shown by default, by section. */
export function featuredDefs(): RecordDef[] {
  const texts = TEXT_SPECS.filter((s) => s.featured).map((s) => textDef(s.key))
  const addrs = FEATURED_COINS.map((n) => coinTypeForName(n)).filter((c): c is number => c !== undefined).map(addressDef)
  return [...texts, ...addrs, contenthashDef]
}

/** Search every known record (text keys, all coins, content hash, abi) by label, key or coin name. */
export function searchDefs(query: string, limit = 12): RecordDef[] {
  const q = query.trim().toLowerCase()
  const pool: RecordDef[] = [
    ...TEXT_SPECS.map((s) => textDef(s.key)),
    ...listCoins().map((c) => addressDef(c.coinType)),
    contenthashDef,
    abiDef(1),
  ]
  if (!q) return pool.filter((d) => d.featured)
  const score = (d: RecordDef) => {
    const hay = [d.label, d.longName ?? "", String(d.arg ?? ""), d.coin ?? ""].map((s) => s.toLowerCase())
    if (hay.some((h) => h === q)) return 3
    if (hay.some((h) => h.startsWith(q))) return 2
    if (hay.some((h) => h.includes(q))) return 1
    return 0
  }
  const out = pool.map((d) => ({ d, s: score(d) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.d.label.localeCompare(b.d.label)).map((x) => x.d).slice(0, limit)
  // a bare key the registry does not know can still be added as a custom text record
  if (out.length === 0 && /^[a-z0-9._-]+$/i.test(q)) out.push(textDef(q))
  return out
}

/** Validate user text for a record. null when fine. */
export function validateValue(def: RecordDef, text: string): string | null {
  switch (def.kind) {
    case "text": {
      const spec = TEXT_SPECS.find((s) => s.key === def.arg)
      return (spec?.validate ?? validateText)(text)
    }
    case "address":
      return validateCoinAddress(def.arg as number, text)
    case "contenthash":
      return validateContenthash(text)
    case "abi":
    case "data":
      return !text.trim() || isHex(text.trim()) ? null : "enter hex bytes starting with 0x"
    case "interface":
      return !text.trim() || /^0x[0-9a-fA-F]{40}$/.test(text.trim()) ? null : "enter the implementer's address"
    case "name":
      return null
  }
}

/** User text → what gets stored. Text records store the string; the rest store hex bytes. */
export function encodeValue(def: RecordDef, text: string): string {
  switch (def.kind) {
    case "text":
    case "name":
      return text.trim()
    case "address":
      return encodeCoinAddress(def.arg as number, text)
    case "contenthash":
      return encodeContenthash(text)
    case "abi":
    case "data":
    case "interface":
      return text.trim() ? (text.trim() as Hex) : "0x"
  }
}

/** Stored form → what the user reads. */
export function decodeValue(def: RecordDef, raw: string): string {
  switch (def.kind) {
    case "text":
    case "name":
      return raw
    case "address":
      return decodeCoinAddress(def.arg as number, raw)
    case "contenthash":
      return decodeContenthash(raw)
    case "abi":
    case "data":
    case "interface":
      return raw === "0x" ? "" : raw
  }
}

export { COIN_TYPE_DEFAULT, COIN_TYPE_ETH }
