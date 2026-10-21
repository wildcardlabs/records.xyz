import { describe, expect, it } from "vitest"
import { publicClient } from "./clients"
import { findResolver, readDataRecord, supportsDataRecords } from "./resolve"
import { getNameOwner } from "./ownership"
import { fetchRecord } from "@/hooks/useRecord"

// Network tests: only run with LIVE=1. They hit public RPCs.
describe.runIf(process.env.LIVE === "1")("live mainnet reads", () => {
  it("finds a resolver, owner and probes data records for vitalik.eth", async () => {
    const client = publicClient(1)
    const resolver = await findResolver(client, "vitalik.eth")
    expect(resolver).toMatch(/^0x[0-9a-fA-F]{40}$/)
    const supports = await supportsDataRecords(client, resolver!)
    const owner = await getNameOwner(client, "vitalik.eth")
    const v = await readDataRecord(client, "vitalik.eth", "accounts[1]").catch((e) => `ERR ${(e as Error).message.split("\n")[0]}`)
    console.log({ resolver, supports, owner, listing: v })
    const rec = await fetchRecord("vitalik.eth", 1)
    console.log(JSON.stringify({ resolver: rec.resolver, supportsData: rec.supportsData, chains: rec.chains.length }))
    expect(rec.resolver).toBe(resolver)
  }, 60_000)
})
