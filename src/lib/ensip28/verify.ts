import { type Address, type Hex, type PublicClient, isAddressEqual, recoverTypedDataAddress, zeroAddress } from "viem"
import { decodeProof } from "./encode"
import { MAX_VALIDITY_SECONDS, consentDigest, consentTypedData } from "./typedData"

export type ProofStatus = "verified" | "expired" | "expiring" | "unverified" | "invalid" | "other-name"

export type ProofCheck = {
  status: ProofStatus
  /** short lowercase reason, for the ui */
  reason: string
  expiresAt?: bigint
  signature?: Hex
}

const ERC1271_MAGIC = "0x1626ba7e"
const erc1271Abi = [
  {
    type: "function",
    name: "isValidSignature",
    stateMutability: "view",
    inputs: [
      { name: "hash", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes4" }],
  },
] as const

/**
 * The spec's validation cascade for one account on its own chain:
 *  - if the account has code, call isValidSignature; only the magic value passes
 *    (a revert or any other value fails this account only);
 *  - otherwise ecrecover; the recovered address must equal `account` and not be zero.
 */
export async function validateConsentSignature(
  client: PublicClient,
  account: Address,
  typed: ReturnType<typeof consentTypedData>,
  signature: Hex
): Promise<boolean> {
  let code: Hex | undefined
  try {
    code = await client.getCode({ address: account })
  } catch {
    return false
  }
  if (code && code !== "0x") {
    try {
      const digest = consentDigest(typed.domain.chainId as number, typed.message)
      const result = await client.readContract({ address: account, abi: erc1271Abi, functionName: "isValidSignature", args: [digest, signature] })
      return result.toLowerCase() === ERC1271_MAGIC
    } catch {
      return false
    }
  }
  try {
    const recovered = await recoverTypedDataAddress({ ...typed, signature })
    return !isAddressEqual(recovered, zeroAddress) && isAddressEqual(recovered, account)
  } catch {
    return false
  }
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
 * ENSIP-28 verification for one listed account, in the spec's order:
 * presence, expiry bounds, then the signature cascade above.
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
  const ok = await validateConsentSignature(input.client, input.account, typed, signature)
  if (!ok) return { status: "invalid", reason: "signature does not verify", expiresAt, signature }

  if (expiresAt - now <= expiringWithin) {
    return { status: "expiring", reason: "verified · expires soon", expiresAt, signature }
  }
  return { status: "verified", reason: "verified", expiresAt, signature }
}

export const isOwned = (s: ProofStatus) => s === "verified" || s === "expiring"
