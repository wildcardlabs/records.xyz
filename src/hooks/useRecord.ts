import { useQuery } from "@tanstack/react-query"
import { type Address, type Hex, namehash } from "viem"
import { ACCOUNT_CHAINS } from "@/lib/ens/chains"
import { publicClient } from "@/lib/ens/clients"
import { findResolver, readDataRecord, readDataRecords, supportsDataRecords } from "@/lib/ens/resolve"
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
  supportsData: boolean
  /** chain ids that carry a listing (from accounts-chains, or probed) */
  chains: ChainListing[]
  fetchedAt: number
}

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
  const resolver = await findResolver(client, name)
  const base: RecordData = { name, node, recordsChainId, resolver, supportsData: false, chains: [], fetchedAt: Date.now() }
  if (!resolver) return base
  base.supportsData = await supportsDataRecords(client, resolver)

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
