export const dataResolverAbi = [
  {
    type: "function",
    name: "data",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    type: "function",
    name: "setData",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "multicall",
    stateMutability: "nonpayable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
  {
    type: "function",
    name: "supportsInterface",
    stateMutability: "view",
    inputs: [{ name: "interfaceID", type: "bytes4" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "DataChanged",
    inputs: [
      { name: "node", type: "bytes32", indexed: true },
      { name: "indexedKey", type: "string", indexed: true },
      { name: "key", type: "string", indexed: false },
      { name: "indexedData", type: "bytes", indexed: true },
    ],
  },
] as const

/** ERC-165 id of the ENSIP-24 `data(bytes32,string)` profile. */
export const DATA_INTERFACE_ID = "0xecbfada3" as const

export const registryAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const

export const nameWrapperAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const

export const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as const

export const NAME_WRAPPER: Record<number, `0x${string}`> = {
  1: "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401",
  11155111: "0x0635513f179D50A207757E05759CbD106d7dFcE8",
}

/** Function selectors used to detect what a deployed resolver can do, independent of ERC-165 (deployments lag their sources). */
export const SELECTORS = {
  data: "ecbfada3", // data(bytes32,string)
  setData: "4eb9c45e", // setData(bytes32,string,bytes)
  multicall: "ac9650d8", // multicall(bytes[])
  resolve: "9061b923", // resolve(bytes,bytes)  ENSIP-10
  hasRoles: "d3bf89b1", // hasRoles(uint256,uint256,address)  ENSv2 PermissionedResolver
  hasRootRoles: "781ef8db", // hasRootRoles(uint256,address)
  canModifyName: "41415eab", // canModifyName(bytes32,address)  ENSv2 PublicResolverV2
} as const

export const permissionedResolverAbi = [
  {
    type: "function",
    name: "hasRoles",
    stateMutability: "view",
    inputs: [
      { name: "resource", type: "uint256" },
      { name: "roleBitmap", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "hasRootRoles",
    stateMutability: "view",
    inputs: [
      { name: "roleBitmap", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "canModifyName",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const

/** PermissionedResolverLib.ROLE_SET_DATA */
export const ROLE_SET_DATA = 1n << 36n

export const universalResolverV2Abi = [
  {
    type: "function",
    name: "findOwner",
    stateMutability: "view",
    inputs: [{ name: "name", type: "bytes" }],
    outputs: [{ type: "address" }],
  },
] as const

/** ENSv2 PermissionedResolver (post-audit-2 branch, live on Sepolia since 2026-10-01): setters take the DNS-encoded name. */
export const nameKeyedResolverAbi = [
  {
    type: "function",
    name: "setData",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "bytes" },
      { name: "key", type: "string" },
      { name: "value", type: "bytes" },
    ],
    outputs: [],
  },
] as const

/** `setData(bytes,string,bytes)` on the name-keyed ENSv2 resolver */
export const SELECTOR_SET_DATA_NAME = "eb4b73bb"

/**
 * ROLE_SET_DATA differs between contracts-v2 branches:
 * post-audit-2 (deployed) uses 1 << 24, main uses 1 << 36. Authority checks accept either.
 */
export const ROLE_SET_DATA_BITS = [1n << 24n, 1n << 36n] as const

/** v1-style node-keyed profile setters (PublicResolver). */
export const nodeKeyedProfileAbi = [
  {
    type: "function",
    name: "setText",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setAddr",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "coinType", type: "uint256" },
      { name: "a", type: "bytes" },
    ],
    outputs: [],
  },
] as const

/** ENSv2 PermissionedResolver name-keyed profile setters. */
export const nameKeyedProfileAbi = [
  {
    type: "function",
    name: "setText",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "bytes" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setAddress",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "bytes" },
      { name: "coinType", type: "uint256" },
      { name: "addressBytes", type: "bytes" },
    ],
    outputs: [],
  },
] as const

export const PROFILE_SELECTORS = {
  setTextNode: "10f13a8c", // setText(bytes32,string,string)
  setAddrNode: "8b95dd71", // setAddr(bytes32,uint256,bytes)
  setTextName: "c7279f88", // setText(bytes,string,string)
  setAddressName: "b4436dde", // setAddress(bytes,uint256,bytes)
} as const

/** Role bits per record kind. data differs between contracts-v2 branches (post-audit-2: 1<<24, main: 1<<36); text and address agree. */
export const ROLE_BITS = {
  data: [1n << 24n, 1n << 36n],
  text: [1n << 4n],
  addr: [1n << 0n],
} as const

/** Node-keyed setters for the remaining v1 profile records. */
export const nodeKeyedMoreAbi = [
  { type: "function", name: "setContenthash", stateMutability: "nonpayable", inputs: [{ name: "node", type: "bytes32" }, { name: "hash", type: "bytes" }], outputs: [] },
  { type: "function", name: "setABI", stateMutability: "nonpayable", inputs: [{ name: "node", type: "bytes32" }, { name: "contentType", type: "uint256" }, { name: "data", type: "bytes" }], outputs: [] },
  { type: "function", name: "setInterface", stateMutability: "nonpayable", inputs: [{ name: "node", type: "bytes32" }, { name: "interfaceID", type: "bytes4" }, { name: "implementer", type: "address" }], outputs: [] },
] as const

/** Name-keyed setters on the ENSv2 PermissionedResolver. */
export const nameKeyedMoreAbi = [
  { type: "function", name: "setContenthash", stateMutability: "nonpayable", inputs: [{ name: "name", type: "bytes" }, { name: "hash", type: "bytes" }], outputs: [] },
  { type: "function", name: "setABI", stateMutability: "nonpayable", inputs: [{ name: "name", type: "bytes" }, { name: "contentType", type: "uint256" }, { name: "data", type: "bytes" }], outputs: [] },
  { type: "function", name: "setInterface", stateMutability: "nonpayable", inputs: [{ name: "name", type: "bytes" }, { name: "interfaceId", type: "bytes4" }, { name: "implementer", type: "address" }], outputs: [] },
] as const

/** Read profiles for the record kinds viem has no helper for. */
export const profileReadAbi = [
  { type: "function", name: "contenthash", stateMutability: "view", inputs: [{ name: "node", type: "bytes32" }], outputs: [{ type: "bytes" }] },
  { type: "function", name: "ABI", stateMutability: "view", inputs: [{ name: "node", type: "bytes32" }, { name: "contentTypes", type: "uint256" }], outputs: [{ type: "uint256" }, { type: "bytes" }] },
  { type: "function", name: "interfaceImplementer", stateMutability: "view", inputs: [{ name: "node", type: "bytes32" }, { name: "interfaceID", type: "bytes4" }], outputs: [{ type: "address" }] },
  { type: "function", name: "text", stateMutability: "view", inputs: [{ name: "node", type: "bytes32" }, { name: "key", type: "string" }], outputs: [{ type: "string" }] },
  { type: "function", name: "addr", stateMutability: "view", inputs: [{ name: "node", type: "bytes32" }, { name: "coinType", type: "uint256" }], outputs: [{ type: "bytes" }] },
] as const

/** Role bits for every record kind (deployed post-audit-2 values; data also accepts main's 1<<36). */
export const KIND_ROLE_BITS: Record<"text" | "address" | "contenthash" | "abi" | "interface" | "data" | "name", readonly bigint[]> = {
  address: [1n << 0n],
  text: [1n << 4n],
  contenthash: [1n << 8n],
  abi: [1n << 12n],
  interface: [1n << 16n],
  name: [1n << 20n],
  data: [1n << 24n, 1n << 36n],
}
