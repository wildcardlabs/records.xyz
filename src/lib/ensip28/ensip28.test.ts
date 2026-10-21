import { describe, expect, it } from "vitest"
import { encodeAbiParameters, keccak256, namehash, toBytes, verifyTypedData } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { CHAINS_KEY, listingKey, parseListingKey, parseProofKey, proofKey } from "./keys"
import { decodeChains, decodeListing, decodeProof, encodeChains, encodeListing, encodeProof } from "./encode"
import { CONSENT_TYPEHASH, SPEC, consentDigest, consentDomain, consentTypedData } from "./typedData"

const A1 = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as const
const A2 = "0xb8c2C29ee19D8307cb7255e1Cd9CbDE883A267d5" as const

describe("keys", () => {
  it("formats listing and proof keys per spec", () => {
    expect(listingKey(1)).toBe("accounts[1]")
    expect(listingKey(8453n)).toBe("accounts[8453]")
    expect(proofKey(1, A1)).toBe("accounts[1][0xd8da6bf26964af9d7eed9e03e53415d37aa96045]")
    expect(CHAINS_KEY).toBe("accounts-chains")
  })
  it("parses keys back", () => {
    expect(parseListingKey("accounts[10]")).toEqual({ chainId: 10 })
    expect(parseListingKey("accounts[010]")).toBeNull()
    expect(parseProofKey(proofKey(10, A2))).toEqual({ chainId: 10, account: A2.toLowerCase() })
    expect(parseProofKey("accounts[1][0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045]")).toBeNull()
  })
})

describe("encode", () => {
  it("round-trips a listing as consecutive 32-byte words", () => {
    const v = encodeListing([A1, A2])
    expect(v.length).toBe(2 + 64 * 2)
    expect(decodeListing(v)).toEqual([A1, A2])
    expect(decodeListing("0x")).toEqual([])
    expect(decodeListing("0x1234")).toBeNull()
  })
  it("rejects words with high bits set", () => {
    const bad = ("0x" + "ff".repeat(12) + A1.slice(2).toLowerCase()) as `0x${string}`
    expect(decodeListing(bad)).toBeNull()
  })
  it("round-trips a proof", () => {
    const v = encodeProof(1798761600n, "0xdeadbeef")
    expect(decodeProof(v)).toEqual({ expiresAt: 1798761600n, signature: "0xdeadbeef" })
    expect(decodeProof("0x")).toBeNull()
  })
  it("round-trips chains", () => {
    expect(decodeChains(encodeChains([1, 8453]))).toEqual([1, 8453])
    expect(decodeChains("0x")).toEqual([])
  })
})

describe("typed data", () => {
  it("matches the spec's type hash", () => {
    expect(CONSENT_TYPEHASH).toBe(SPEC.consentTypeHash)
  })
  it("matches the spec's domain type hash and separators", () => {
    const domainTypeHash = keccak256(toBytes("EIP712Domain(string name,string version,uint256 chainId)"))
    expect(domainTypeHash).toBe(SPEC.domainTypeHash)
    for (const [chainId, expected] of Object.entries(SPEC.domainSeparators)) {
      const d = consentDomain(Number(chainId))
      const sep = keccak256(
        encodeAbiParameters(
          [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }],
          [domainTypeHash, keccak256(toBytes(d.name!)), keccak256(toBytes(d.version!)), BigInt(d.chainId!)]
        )
      )
      expect(sep).toBe(expected)
    }
  })
  it("produces a signature an EOA can verify, bound to account and chain", async () => {
    const signer = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")
    const msg = { node: namehash("agent.example.eth"), accountChainId: 8453n, account: signer.address, expiresAt: 1798761600n }
    const typed = consentTypedData(1, msg)
    const signature = await signer.signTypedData(typed)
    expect(await verifyTypedData({ address: signer.address, signature, ...typed })).toBe(true)
    // same signer, different chain id → must not verify
    const other = consentTypedData(1, { ...msg, accountChainId: 10n })
    expect(await verifyTypedData({ address: signer.address, signature, ...other })).toBe(false)
    expect(consentDigest(1, msg)).toMatch(/^0x[0-9a-f]{64}$/)
  })
})
