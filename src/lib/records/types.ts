/** Every record a name can carry is one of these kinds; the argument distinguishes records within a kind. */
export type RecordKind = "text" | "address" | "contenthash" | "abi" | "interface" | "data" | "name"

/** Where a record shows up in the editor and on the profile. */
export type Section = "profile" | "links" | "addresses" | "website" | "advanced" | "owned"

export type RecordDef = {
  /** stable id: `text:description`, `address:60`, `contenthash`, `abi:1`, `interface:0x…`, `data:<key>` */
  id: string
  kind: RecordKind
  /** text/data key, address coin type, abi content type, or interface id, depending on kind */
  arg?: string | number
  label: string
  /** longer name for tooltips and search, e.g. "Bitcoin" for btc */
  longName?: string
  section: Section
  placeholder?: string
  hint?: string
  /** address records only: EVM chain id for ENSIP-11 coin types, 0 for the ENSIP-19 default */
  chainId?: number
  /** address records only: short coin name from the encoder ("btc", "sol", "base") */
  coin?: string
  /** true for records the editor shows by default; others are reachable through search */
  featured?: boolean
}

/** A decoded, display-ready value together with its onchain form. */
export type RecordValue = {
  def: RecordDef
  /** what the user sees and edits */
  text: string
  /** what is stored: hex bytes for address/contenthash/abi/data, the string itself for text */
  raw: string
}
