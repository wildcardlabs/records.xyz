import { describe, expect, it } from "vitest"
import { COIN_TYPE_DEFAULT, chainIdForCoinType, coinMeta, coinTypeForChain, coinTypeForName, decodeCoinAddress, encodeCoinAddress, validateCoinAddress } from "./address"
import { decodeContenthash, encodeContenthash, validateContenthash } from "./contenthash"
import { addressDef, decodeValue, defFromId, encodeValue, featuredDefs, searchDefs, textDef, validateValue } from "./registry"

describe("coin types", () => {
  it("maps EVM chains per ENSIP-11 and the ENSIP-19 default", () => {
    expect(coinTypeForChain(1)).toBe(60)
    expect(coinTypeForChain(8453)).toBe(2147492101)
    expect(chainIdForCoinType(2147492101)).toBe(8453)
    expect(chainIdForCoinType(COIN_TYPE_DEFAULT)).toBe(0)
    expect(chainIdForCoinType(0)).toBeNull()
    expect(coinMeta(0).longName).toBe("Bitcoin")
    expect(coinMeta(COIN_TYPE_DEFAULT).name).toBe("default")
    expect(coinMeta(coinTypeForChain(84532)).longName).toBe("EVM chain 84532")
    expect(coinTypeForName("sol")).toBe(501)
  })
})

describe("address codecs", () => {
  it("round-trips bitcoin bech32 and base58", () => {
    const bech = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"
    const raw = encodeCoinAddress(0, bech)
    expect(raw).toBe("0x0014751e76e8199196d454941c45d1b3a323f1433bd6")
    expect(decodeCoinAddress(0, raw)).toBe(bech)
    const legacy = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
    expect(decodeCoinAddress(0, encodeCoinAddress(0, legacy))).toBe(legacy)
  })
  it("round-trips solana and checksums EVM", () => {
    const sol = "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV"
    expect(decodeCoinAddress(501, encodeCoinAddress(501, sol))).toBe(sol)
    expect(encodeCoinAddress(60, "0xd8da6bf26964af9d7eed9e03e53415d37aa96045")).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
    expect(encodeCoinAddress(COIN_TYPE_DEFAULT, "0xd8da6bf26964af9d7eed9e03e53415d37aa96045")).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
    expect(encodeCoinAddress(coinTypeForChain(84532), "0xd8da6bf26964af9d7eed9e03e53415d37aa96045")).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })
  it("rejects garbage with a readable message and clears on empty", () => {
    expect(validateCoinAddress(0, "0xd8da6bf26964af9d7eed9e03e53415d37aa96045")).toMatch(/Bitcoin/)
    expect(validateCoinAddress(60, "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4")).toBe("not a valid EVM address")
    expect(validateCoinAddress(501, "")).toBeNull()
    expect(encodeCoinAddress(0, "  ")).toBe("0x")
    expect(decodeCoinAddress(0, "0x")).toBe("")
  })
})

describe("content hash", () => {
  it("round-trips ipfs, ipns and arweave urls", () => {
    for (const url of [
      "ipfs://QmRAQB6YaCyidP37UdDnjFY5vQuiBrcqdyoW1CuDgwxkD4",
      "ipns://k51qzi5uqu5dlvj2baxnqndepeb86cbk3ng7n3i46uzyxzyqj2xjonzllnv0v8",
      "bzz://d1de9994b4d039f6548d191eb26786769f580809256b4685ef316805265ea162",
      "onion3://p53lf57qovyuvwsc6xnrppyply3vtqm7l6pcobkmyqsiofyeznfu5uqd",
      "ar://ys-WlFNzGYvO-LxjUgOk5NLEDLmoOqSEYkkxOFaQUhc",
    ]) {
      const raw = encodeContenthash(url)
      expect(raw).toMatch(/^0x[0-9a-f]+$/)
      const back = decodeContenthash(raw)
      expect(back.split("://")[0]).toBe(url.split("://")[0])
    }
  })
  it("explains bad input", () => {
    expect(validateContenthash("example.com")).toMatch(/scheme/)
    expect(validateContenthash("ftp://x")).toMatch(/unsupported/)
    expect(validateContenthash("ipns://vitalik.eth")).toMatch(/key id/)
    expect(validateContenthash("")).toBeNull()
    expect(decodeContenthash("0x")).toBe("")
  })
})

describe("registry", () => {
  it("builds defs, ids and sections", () => {
    expect(textDef("com.twitter").section).toBe("links")
    expect(textDef("whatever.key").section).toBe("advanced")
    expect(addressDef(0).coin).toBe("btc")
    expect(addressDef(COIN_TYPE_DEFAULT).hint).toMatch(/ENSIP-19/)
    expect(defFromId("address:501")?.label).toBe("sol")
    expect(defFromId("text:url")?.label).toBe("website")
    expect(defFromId("contenthash")?.kind).toBe("contenthash")
    expect(featuredDefs().some((d) => d.id === "address:2147483648")).toBe(true)
  })
  it("searches text keys, every coin and falls back to a custom key", () => {
    expect(searchDefs("bitcoin")[0].coin).toBe("btc")
    expect(searchDefs("doge")[0].longName).toBe("Dogecoin")
    expect(searchDefs("twit")[0].id).toBe("text:com.twitter")
    expect(searchDefs("com.linkedin")[0].id).toBe("text:com.linkedin")
    expect(searchDefs("my.custom.key")[0].id).toBe("text:my.custom.key")
    expect(searchDefs("").every((d) => d.featured)).toBe(true)
  })
  it("validates, encodes and decodes through the def", () => {
    expect(validateValue(textDef("com.twitter"), "@alice")).toBe("leave out the @")
    expect(validateValue(textDef("url"), "alice")).toMatch(/web address/)
    expect(validateValue(textDef("timezone"), "Europe/Lisbon")).toBeNull()
    expect(validateValue(addressDef(0), "nope")).toMatch(/Bitcoin/)
    const sol = addressDef(501)
    const raw = encodeValue(sol, "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV")
    expect(decodeValue(sol, raw)).toBe("7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV")
    expect(encodeValue(textDef("description"), "  hi  ")).toBe("hi")
    expect(decodeValue(defFromId("contenthash")!, encodeValue(defFromId("contenthash")!, "ipfs://QmRAQB6YaCyidP37UdDnjFY5vQuiBrcqdyoW1CuDgwxkD4"))).toMatch(/^ipfs:\/\//)
  })
})
