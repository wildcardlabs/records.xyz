import { describe, expect, it } from "vitest"
import { decodeFunctionData, encodeFunctionData, namehash } from "viem"
import { buildLinkCall, dnsName, linkAbi } from "./links"
import { accessAbi, buildAccessCall, keyResource } from "./roles"
import { nameKeyedProfileAbi } from "./abis"

describe("record links", () => {
  it("encodes linkToRecord with the DNS-encoded source name", () => {
    const call = buildLinkCall({ sourceName: "alice.eth", recordId: "7", scope: "" })
    const d = decodeFunctionData({ abi: linkAbi, data: call })
    expect(d.functionName).toBe("linkToRecord")
    expect(d.args).toEqual([dnsName("alice.eth"), 7n])
  })
  it("the root name encodes as a single zero byte and sets the default record", () => {
    expect(dnsName("")).toBe("0x00")
    const d = decodeFunctionData({ abi: linkAbi, data: buildLinkCall({ sourceName: "", recordId: "1", scope: "" }) })
    expect(d.args).toEqual(["0x00", 1n])
  })
  it("namehash of the root name is the zero node", () => {
    expect(namehash("")).toBe(`0x${"0".repeat(64)}`)
  })
})

describe("scoped grants", () => {
  const account = "0x1208a26FAa0F4AC65B42098419EB4dAA5e580AC6"
  it("go through grantSetterRoles with the setter that names the key", () => {
    const setter = encodeFunctionData({ abi: nameKeyedProfileAbi, functionName: "setText", args: [dnsName("steve.eth"), "avatar", ""] })
    const call = buildAccessCall({ account, resource: keyResource("avatar").toString(), roleBitmap: (1n << 4n).toString(), revoke: false, scope: "", setter })
    const d = decodeFunctionData({ abi: accessAbi, data: call })
    expect(d.functionName).toBe("grantSetterRoles")
    expect(d.args).toEqual([setter, account])
  })
  it("revokes and root grants keep the plain role calls", () => {
    const revoke = decodeFunctionData({ abi: accessAbi, data: buildAccessCall({ account, resource: keyResource("avatar").toString(), roleBitmap: "16", revoke: true, scope: "" }) })
    expect(revoke.functionName).toBe("revokeRoles")
    const root = decodeFunctionData({ abi: accessAbi, data: buildAccessCall({ account, resource: "0", roleBitmap: "16", revoke: false, scope: "" }) })
    expect(root.functionName).toBe("grantRootRoles")
  })
  it("refuses a scoped grant without its setter", () => {
    expect(() => buildAccessCall({ account, resource: "123", roleBitmap: "16", revoke: false, scope: "" })).toThrow()
  })
})
