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
