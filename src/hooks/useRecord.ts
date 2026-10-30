import { useQuery } from "@tanstack/react-query"
import { type Address, type Hex, namehash } from "viem"
import { ACCOUNT_CHAINS } from "@/lib/ens/chains"
import { ENS_REGISTRY } from "@/lib/ens/abis"
import { loadLinks, siblingsOf } from "@/lib/ens/links"
import { publicClient } from "@/lib/ens/clients"
import { findResolver, readDataRecord, readDataRecords } from "@/lib/ens/resolve"
import { type ResolverCapabilities, resolverCapabilities, supportsOwnedAccounts } from "@/lib/ens/capabilities"
import { CHAINS_KEY, type ProofCheck, decodeChains, decodeListing, listingKey, proofKey, verifyOwnedAccount } from "@/lib/ensip28"

export type AccountKind = "eoa" | "contract" | "7702"

export type OwnedAccount = {
  chainId: number
  account: Address
  kind: AccountKind
  check: ProofCheck
  proofValue: Hex
}

export type ChainListing = {
  chainId: number
  accounts: OwnedAccount[]
  /** the listing record exists but is not a whole number of address words */
  malformed: boolean
}

export type RecordData = {
  name: string
  node: Hex
  recordsChainId: number
  resolver: Address | null
  /** records can be read and written on this resolver (ENSIP-24 data profile) */
  supportsData: boolean
  capabilities: ResolverCapabilities | null
  /** an unmigrated v1 name with no resolver set: reads come from the read-only mirror and nothing can be written */
  noResolver: boolean
  /** chain ids that carry a listing (from accounts-chains, or probed) */
  chains: ChainListing[]
  fetchedAt: number
}

const registryResolverAbi = [{ type: "function", name: "resolver", stateMutability: "view", inputs: [{ type: "bytes32" }], outputs: [{ type: "address" }] }] as const

async function accountKind(chainId: number, account: Address): Promise<AccountKind> {
  try {
    const code = await publicClient(chainId).getCode({ address: account })
    if (!code || code === "0x") return "eoa"
    if (code.toLowerCase().startsWith("0xef0100")) return "7702"
    return "contract"
  } catch {
    return "eoa"
  }
}

export async function fetchRecord(name: string, recordsChainId: number): Promise<RecordData> {
  const client = publicClient(recordsChainId)
  const node = namehash(name)
  let resolver = await findResolver(client, name)
  const base: RecordData = { name, node, recordsChainId, resolver, supportsData: false, capabilities: null, noResolver: false, chains: [], fetchedAt: Date.now() }
  if (!resolver) return base
  let caps = await resolverCapabilities(client, name, resolver)
  // ENSv2's Universal Resolver answers for an unmigrated v1 name through a read-only mirror of the
  // v1 registry. Writes still go to the resolver the v1 registry names, so use that one when the
  // mirror exposes no setters and the registry has a different resolver with some.
  if (caps.writeFlavour === null && caps.profileWrite === null) {
    const v1 = await client.readContract({ address: ENS_REGISTRY, abi: registryResolverAbi, functionName: "resolver", args: [node] }).catch(() => null)
    if (v1 && /^0x0{40}$/.test(v1)) base.noResolver = true
    if (v1 && !/^0x0{40}$/.test(v1) && v1.toLowerCase() !== resolver.toLowerCase()) {
      const v1caps = await resolverCapabilities(client, name, v1)
      if (v1caps.writeFlavour !== null || v1caps.profileWrite !== null) {
        resolver = v1
        caps = { ...v1caps, readsData: caps.readsData || v1caps.readsData }
        base.resolver = v1
      }
    }
  }
  base.capabilities = caps
  base.supportsData = supportsOwnedAccounts(caps)

  // which chains to look at: the optional accounts-chains record, else probe every supported chain
  const chainsValue = await readDataRecord(client, name, CHAINS_KEY).catch(() => "0x" as Hex)
  const declared = decodeChains(chainsValue)
  const chainIds = declared && declared.length > 0 ? declared : ACCOUNT_CHAINS.map((c) => c.chain.id)

  const listings = await readDataRecords(client, name, chainIds.map((c) => listingKey(c)))

  const chains: ChainListing[] = []
  for (const chainId of chainIds) {
    const raw = listings[listingKey(chainId)]
    const accounts = decodeListing(raw)
    if (accounts === null) {
      chains.push({ chainId, accounts: [], malformed: true })
      continue
    }
    if (accounts.length === 0) continue
    const proofs = await readDataRecords(client, name, accounts.map((a) => proofKey(chainId, a)))
    const supported = ACCOUNT_CHAINS.some((c) => c.chain.id === chainId)
    const rows = await Promise.all(
      accounts.map(async (account): Promise<OwnedAccount> => {
        const proofValue = proofs[proofKey(chainId, account)]
        if (!supported) {
          return { chainId, account, kind: "eoa", proofValue, check: { status: "unverified", reason: "chain not supported by this client" } }
        }
        const [kind, check] = await Promise.all([
          accountKind(chainId, account),
          verifyOwnedAccount({ node, recordsChainId, accountChainId: chainId, account, proofValue, client: publicClient(chainId) }),
        ])
        return { chainId, account, kind, check, proofValue }
      })
    )
    chains.push({ chainId, accounts: rows, malformed: false })
  }
  // on a shared profile the consents travel with the record but each names one ENS name: a proof that
  // fails here may verify under a sibling name. say so instead of "invalid".
  const foreign = chains.flatMap((c) => c.accounts.filter((a) => a.check.status === "invalid" && a.check.reason === "signature does not verify"))
  if (foreign.length > 0 && caps.links) {
    try {
      const links = await loadLinks(client, recordsChainId, name, resolver)
      const siblings = siblingsOf(links.rows, name)
      for (const a of foreign) {
        for (const sib of siblings) {
          const check = await verifyOwnedAccount({ node: namehash(sib), recordsChainId, accountChainId: a.chainId, account: a.account, proofValue: a.proofValue, client: publicClient(a.chainId) })
          if (check.status === "verified" || check.status === "expiring") {
            a.check = { ...check, status: "other-name", reason: `signed for ${sib}` }
            break
          }
        }
      }
    } catch {
      /* leave them invalid */
    }
  }
  base.chains = chains
  return base
}

export const recordQueryKey = (name: string, recordsChainId: number) => ["record", recordsChainId, name] as const

export function useRecord(name: string | undefined, recordsChainId: number) {
  return useQuery({
    queryKey: recordQueryKey(name ?? "", recordsChainId),
    queryFn: () => fetchRecord(name!, recordsChainId),
    enabled: !!name,
    staleTime: 60_000,
    retry: 1,
  })
}
