import { type Hex, type PublicClient, decodeFunctionResult, encodeFunctionData, getChainContractAddress, namehash, toHex } from "viem"
import { packetToBytes } from "viem/ens"
import { profileReadAbi } from "./abis"
import { fetchBigName, hasBigName } from "./bigname"
import { COIN_TYPE_DEFAULT, TEXT_SPECS, type RecordDef, addressDef, contenthashDef, decodeValue, featuredDefs, textDef } from "@/lib/records"

/** Stored values keyed by record id (`text:url`, `address:60`, `contenthash`, …). Raw form, not decoded. */
export type RecordSet = {
  values: Record<string, string>
  source: "chain" | "bigname"
  asOfBlock?: number | null
}

const universalResolverResolveAbi = [
  {
    name: "resolveWithGateways",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "name", type: "bytes" }, { name: "data", type: "bytes" }, { name: "gateways", type: "string[]" }],
    outputs: [{ name: "", type: "bytes" }, { name: "address", type: "address" }],
  },
] as const

/** One profile read through the Universal Resolver; "" / "0x" on empty or unsupported. */
async function readProfile(client: PublicClient, name: string, fn: "contenthash" | "ABI" | "interfaceImplementer" | "text" | "addr", args: readonly unknown[]): Promise<string> {
  try {
    const ur = getChainContractAddress({ chain: client.chain!, contract: "ensUniversalResolver" })
    // viem's abi typing wants the exact tuple per function; the call shape is identical for each
    const calldata = encodeFunctionData({ abi: profileReadAbi, functionName: fn, args: args as never })
    const [result] = await client.readContract({
      address: ur,
      abi: universalResolverResolveAbi,
      functionName: "resolveWithGateways",
      args: [toHex(packetToBytes(name)), calldata, ["x-batch-gateway:true"]],
    })
    if (!result || result === "0x") return ""
    const decoded = decodeFunctionResult({ abi: profileReadAbi, functionName: fn, data: result }) as unknown
    if (fn === "ABI") return (decoded as readonly [bigint, Hex])[1]
    return String(decoded)
  } catch {
    return ""
  }
}

const isEmpty = (v: string) => !v || v === "0x" || v === "0x0000000000000000000000000000000000000000"

/**
 * Read every record we know how to show for a name: BigName when it covers the chain, otherwise
 * the chain through the Universal Resolver. Values stay in stored form; decode with the registry.
 */
export type RecordSetOptions = {
  /** read values from the chain even when an indexer exists (ENSv2 shared profiles: the indexer may lag a link) */
  chainFirst?: boolean
  /** names whose indexed key inventories to read from chain as well (names sharing this profile) */
  keyNames?: string[]
}

export async function fetchRecordSet(client: PublicClient, name: string, recordsChainId: number, extraDefs: RecordDef[] = [], opts: RecordSetOptions = {}): Promise<RecordSet> {
  const values: Record<string, string> = {}
  if (hasBigName(recordsChainId) && opts.chainFirst) {
    // the indexer knows which keys exist; the chain knows their current values
    const inventory = await Promise.all([name, ...(opts.keyNames ?? [])].map((n) => fetchBigName(recordsChainId, n).catch(() => null)))
    for (const bn of inventory) {
      if (!bn) continue
      for (const k of Object.keys(bn.texts)) extraDefs = [...extraDefs, textDef(k)]
      for (const ct of Object.keys(bn.addresses)) extraDefs = [...extraDefs, addressDef(Number(ct))]
    }
  } else if (hasBigName(recordsChainId)) {
    try {
      const bn = await fetchBigName(recordsChainId, name)
      if (bn) {
        for (const [k, v] of Object.entries(bn.texts)) if (v) values[textDef(k).id] = v
        for (const [ct, v] of Object.entries(bn.addresses)) if (!isEmpty(v)) values[addressDef(Number(ct)).id] = v
        // the indexer does not carry the content hash; fetch it from chain alongside
        const ch = await readProfile(client, name, "contenthash", [namehash(name)])
        if (!isEmpty(ch)) values[contenthashDef.id] = ch
        return { values, source: "bigname", asOfBlock: bn.asOfBlock }
      }
    } catch {
      /* fall through to chain */
    }
  }

  const node = namehash(name)
  // every text key the registry knows plus the featured coins; anything else arrives through extraDefs
  const defs = [...TEXT_SPECS.map((t) => textDef(t.key)), textDef("theme"), ...featuredDefs(), ...extraDefs]
  const seen = new Set<string>()
  await Promise.all(
    defs.map(async (def) => {
      if (seen.has(def.id)) return
      seen.add(def.id)
      let v = ""
      if (def.kind === "text") v = await readProfile(client, name, "text", [node, def.arg as string])
      else if (def.kind === "address") v = await readProfile(client, name, "addr", [node, BigInt(def.arg as number)])
      else if (def.kind === "contenthash") v = await readProfile(client, name, "contenthash", [node])
      if (!isEmpty(v)) values[def.id] = v
    })
  )
  return { values, source: "chain" }
}

/** Decoded text for one record id, or "". */
export function recordText(set: RecordSet | undefined, def: RecordDef): string {
  const raw = set?.values[def.id]
  return raw ? decodeValue(def, raw) : ""
}

/** The EVM address a chain resolves to, honouring the ENSIP-19 default fallback. */
export function evmAddressFor(set: RecordSet | undefined, coinType: number): string {
  const own = set?.values[addressDef(coinType).id]
  if (own && !isEmpty(own)) return own
  const dflt = set?.values[addressDef(COIN_TYPE_DEFAULT).id]
  return dflt && !isEmpty(dflt) ? dflt : ""
}
