import type { Address, Hex, PublicClient } from "viem"
import { decodeProof } from "./encode"
import { MAX_VALIDITY_SECONDS, consentTypedData } from "./typedData"

export type ProofStatus = "verified" | "expired" | "expiring" | "unverified" | "invalid"

export type ProofCheck = {
  status: ProofStatus
  /** short lowercase reason, for the ui */
  reason: string
  expiresAt?: bigint
  signature?: Hex
}

export type VerifyInput = {
  /** namehash of the listing name */
  node: Hex
  /** chain the name's records live on (EIP-712 domain chainId) */
  recordsChainId: number
  /** chain the listed account is on; the client must be connected to it */
  accountChainId: number
  account: Address
  /** raw proof record value, or undefined when the record is absent */
  proofValue: Hex | undefined
  /** public client for `accountChainId` */
  client: PublicClient
  /** unix seconds; defaults to now */
  now?: bigint
  /** mark proofs expiring within this many seconds as "expiring" (ui only; still verified) */
  expiringWithin?: bigint
}

/**
 * ENSIP-28 verification for one listed account.
 * Order of checks mirrors the spec: presence, expiry bounds, then signature
 * (ERC-1271 when the account has code, ecrecover otherwise).
 */
export async function verifyOwnedAccount(input: VerifyInput): Promise<ProofCheck> {
  const now = input.now ?? BigInt(Math.floor(Date.now() / 1000))
  const expiringWithin = input.expiringWithin ?? 30n * 24n * 60n * 60n

  if (!input.proofValue || input.proofValue === "0x") {
    return { status: "unverified", reason: "no proof record" }
  }
  const proof = decodeProof(input.proofValue)
  if (!proof) return { status: "invalid", reason: "proof record is malformed" }
  const { expiresAt, signature } = proof

  if (expiresAt === 0n) return { status: "invalid", reason: "expiry is zero", expiresAt, signature }
  if (!signature || signature === "0x") return { status: "invalid", reason: "signature is empty", expiresAt, signature }
  if (now >= expiresAt) return { status: "expired", reason: "proof expired", expiresAt, signature }
  if (expiresAt > now + MAX_VALIDITY_SECONDS) {
    return { status: "invalid", reason: "expiry is more than two years ahead", expiresAt, signature }
  }

  const typed = consentTypedData(input.recordsChainId, {
    node: input.node,
    accountChainId: BigInt(input.accountChainId),
    account: input.account,
    expiresAt,
  })

  let ok = false
  try {
    // viem's public verifyTypedData: ERC-1271 when the address has code, ecrecover otherwise.
    ok = await input.client.verifyTypedData({ address: input.account, signature, ...typed })
  } catch {
    ok = false
  }
  if (!ok) return { status: "invalid", reason: "signature does not verify", expiresAt, signature }

  if (expiresAt - now <= expiringWithin) {
    return { status: "expiring", reason: "verified · expires soon", expiresAt, signature }
  }
  return { status: "verified", reason: "verified", expiresAt, signature }
}

export const isOwned = (s: ProofStatus) => s === "verified" || s === "expiring"
