import { type Address, type Hex, encodeAbiParameters, encodeFunctionData, keccak256, toBytes } from "viem"

/**
 * ENSv2 PermissionedResolver access control (post-audit-2 branch, deployed on Sepolia 2026-10-01).
 * Roles are bits; the admin role for a bit is the same bit shifted left by 128. Roles granted on
 * ROOT_RESOURCE (0) apply to every resource. A resource is keccak256 of the record argument:
 * the text/data key as a string, or the coin type as a 32-byte word. There is no name in the
 * resource, so a grant applies to every name this resolver instance serves.
 */
export const ROOT_RESOURCE = 0n

export const ROLE = {
  address: 1n << 0n,
  text: 1n << 4n,
  contenthash: 1n << 8n,
  abi: 1n << 12n,
  interface: 1n << 16n,
  name: 1n << 20n,
  data: 1n << 24n,
  link: 1n << 28n,
  canName: 1n << 120n,
  upgrade: 1n << 124n,
} as const

export type Power = keyof typeof ROLE

export const adminOf = (bits: bigint) => bits << 128n

export const POWER_LABEL: Record<Power, string> = {
  address: "payment addresses",
  text: "text records",
  data: "owned accounts",
  contenthash: "content hash",
  abi: "abi",
  interface: "interfaces",
  name: "primary name",
  link: "record links",
  canName: "contract naming",
  upgrade: "resolver upgrades",
}

/** BigName's power names for the same bits. */
const BIGNAME_POWER: Record<string, Power> = {
  set_addr: "address",
  set_address: "address",
  set_text: "text",
  set_data: "data",
  set_contenthash: "contenthash",
  set_abi: "abi",
  set_interface: "interface",
  set_name: "name",
  link: "link",
  can_name: "canName",
  upgrade: "upgrade",
}

export function powersFromBigName(names: string[]): { powers: Power[]; admin: Power[] } {
  const powers: Power[] = []
  const admin: Power[] = []
  for (const n of names) {
    if (n.startsWith("admin_")) {
      const p = BIGNAME_POWER[n.slice(6)]
      if (p) admin.push(p)
    } else {
      const p = BIGNAME_POWER[n]
      if (p) powers.push(p)
    }
  }
  return { powers, admin }
}

export function bitmapFor(powers: Power[], withAdmin: boolean): bigint {
  let bits = 0n
  for (const p of powers) bits |= ROLE[p] | (withAdmin ? adminOf(ROLE[p]) : 0n)
  return bits
}

export function describeBitmap(bits: bigint): { powers: Power[]; admin: Power[] } {
  const powers: Power[] = []
  const admin: Power[] = []
  for (const [k, bit] of Object.entries(ROLE) as [Power, bigint][]) {
    if (bits & bit) powers.push(k)
    if (bits & adminOf(bit)) admin.push(k)
  }
  return { powers, admin }
}

/** resource(string key) = uint256(keccak256(bytes(key))) */
export const keyResource = (key: string) => BigInt(keccak256(toBytes(key)))
/** resource(uint256 coinType) = uint256(keccak256(abi.encodePacked(coinType))) */
export const coinResource = (coinType: number) => BigInt(keccak256(encodeAbiParameters([{ type: "uint256" }], [BigInt(coinType)])))

export const accessAbi = [
  { type: "function", name: "grantRoles", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "grantRootRoles", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "revokeRoles", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "revokeRootRoles", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "roles", stateMutability: "view", inputs: [{ type: "uint256" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "grantSetterRoles", stateMutability: "nonpayable", inputs: [{ type: "bytes" }, { type: "address" }], outputs: [{ type: "bool" }] },
] as const

/** A staged access change. Numbers travel as decimal strings because the drafts store is JSON. */
export type AccessChange = {
  account: Address
  /** decimal resource id; "0" is the root resource (every key) */
  resource: string
  /** decimal role bitmap */
  roleBitmap: string
  revoke: boolean
  /** human label for the scope, e.g. "all keys" or "text key avatar" */
  scope: string
  /**
   * scoped grants only: the ABI-encoded setter call (`setText(name, key, "")`, …) whose argument
   * names the resource. The deployed PermissionedResolver disables `grantRoles` and derives
   * per-key grants from a setter through `grantSetterRoles`; revokes still use `revokeRoles`.
   */
  setter?: Hex
}

export function buildAccessCall(c: AccessChange): Hex {
  const resource = BigInt(c.resource)
  const bits = BigInt(c.roleBitmap)
  if (resource === ROOT_RESOURCE) {
    return encodeFunctionData({ abi: accessAbi, functionName: c.revoke ? "revokeRootRoles" : "grantRootRoles", args: [bits, c.account] })
  }
  if (c.revoke) return encodeFunctionData({ abi: accessAbi, functionName: "revokeRoles", args: [resource, bits, c.account] })
  if (!c.setter) throw new Error("a scoped grant needs its setter call")
  return encodeFunctionData({ abi: accessAbi, functionName: "grantSetterRoles", args: [c.setter, c.account] })
}

/** Admin bits a caller must hold (on the resource or on root) to apply this change. */
export function adminBitsFor(c: AccessChange): bigint {
  const bits = BigInt(c.roleBitmap)
  let need = 0n
  for (const bit of Object.values(ROLE)) {
    if (bits & bit) need |= adminOf(bit)
    if (bits & adminOf(bit)) need |= adminOf(bit)
  }
  return need
}
