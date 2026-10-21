import { type Address, type Hex, type TypedDataDomain, hashTypedData, keccak256, toBytes } from "viem"

/** EIP-712 domain. No verifyingContract, so proofs survive a resolver migration. */
export function consentDomain(recordsChainId: number): TypedDataDomain {
  return { name: "ENS Name Owned Accounts", version: "1", chainId: recordsChainId }
}

export const CONSENT_TYPES = {
  Consent: [
    { name: "node", type: "bytes32" },
    { name: "accountChainId", type: "uint256" },
    { name: "account", type: "address" },
    { name: "expiresAt", type: "uint256" },
  ],
} as const

export type ConsentMessage = {
  node: Hex
  accountChainId: bigint
  account: Address
  expiresAt: bigint
}

/** keccak256("Consent(bytes32 node,uint256 accountChainId,address account,uint256 expiresAt)") */
export const CONSENT_TYPEHASH = keccak256(
  toBytes("Consent(bytes32 node,uint256 accountChainId,address account,uint256 expiresAt)")
)

/** Reference values published in ENSIP-28; tests check our hashing against them. */
export const SPEC = {
  consentTypeHash: "0x8dff32c14409d396587044aa7663b77f60b1d374ec13710f3f0acdc3a810a94d",
  domainTypeHash: "0xc2f8787176b8ac6bf7215b4adcc1e069bf4ab82d9ab1df05a57a91d425935b6e",
  domainSeparators: {
    1: "0xefbd5fd6831eeaf1b039217878898cb25c5afb12a1789321e1e4b870d56bdab0",
    11155111: "0x0e8de794261382cbb6e04b05bebc36d7e32e3461ee7f992d81fb7236a1419cd6",
  } as Record<number, Hex>,
} as const

/** Full typed-data payload for signing with any EIP-712 capable wallet. */
export function consentTypedData(recordsChainId: number, message: ConsentMessage) {
  return {
    domain: consentDomain(recordsChainId),
    types: CONSENT_TYPES,
    primaryType: "Consent" as const,
    message,
  }
}

export function consentDigest(recordsChainId: number, message: ConsentMessage): Hex {
  return hashTypedData(consentTypedData(recordsChainId, message))
}

/** Longest allowed validity window: two years, in seconds. */
export const MAX_VALIDITY_SECONDS = 2n * 365n * 24n * 60n * 60n
