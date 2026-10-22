/**
 * TON ADNL addresses. Onchain the content hash stores the raw 32-byte ADNL id (multicodec `adnl`).
 * TON tooling also shows the id as a 55-character base32 string: base32(0x2d ‖ id ‖ crc16-xmodem).
 */
const B32 = "abcdefghijklmnopqrstuvwxyz234567"

function crc16Xmodem(bytes: Uint8Array): number {
  let crc = 0
  for (const b of bytes) {
    crc ^= b << 8
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc
}

function base32Decode(s: string): Uint8Array {
  const clean = s.toLowerCase().replace(/=+$/, "")
  const out: number[] = []
  let bits = 0
  let value = 0
  for (const ch of clean) {
    const idx = B32.indexOf(ch)
    if (idx < 0) throw new Error("bad base32")
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Uint8Array.from(out)
}

function base32Encode(bytes: Uint8Array): string {
  let out = ""
  let bits = 0
  let value = 0
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

const hexToBytes = (hex: string) => Uint8Array.from(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)))
const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")

/** Accepts the 64-hex id (with or without 0x) or the 55-character TON form; returns the 64-hex id. */
export function tonAdnlToHex(input: string): string {
  const t = input.trim()
  const hex = t.startsWith("0x") ? t.slice(2) : t
  if (/^[0-9a-fA-F]{64}$/.test(hex)) return hex.toLowerCase()
  if (/^[a-zA-Z2-7]{55}$/.test(t)) {
    const bytes = base32Decode(t)
    if (bytes.length < 35 || bytes[0] !== 0x2d) throw new Error("not a TON ADNL address")
    const id = bytes.slice(1, 33)
    const crc = (bytes[33] << 8) | bytes[34]
    if (crc16Xmodem(bytes.slice(0, 33)) !== crc) throw new Error("TON ADNL address checksum does not match")
    return bytesToHex(id)
  }
  throw new Error("adnl needs the 32-byte id as hex or the 55-character TON address")
}

/** 64-hex id → the 55-character TON form. */
export function hexToTonAdnl(hex: string): string {
  const id = hexToBytes(hex.startsWith("0x") ? hex.slice(2) : hex)
  const body = new Uint8Array(33)
  body[0] = 0x2d
  body.set(id, 1)
  const crc = crc16Xmodem(body)
  const full = new Uint8Array(35)
  full.set(body)
  full[33] = crc >> 8
  full[34] = crc & 0xff
  return base32Encode(full)
}
