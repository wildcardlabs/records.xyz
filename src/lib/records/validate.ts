/** Small validators for text records. Return null when fine, else the message to show. */

export function validateUrl(v: string): string | null {
  const t = v.trim()
  if (!t) return null
  try {
    const u = new URL(t.includes("://") ? t : `https://${t}`)
    return u.hostname.includes(".") ? null : "enter a full web address"
  } catch {
    return "enter a full web address"
  }
}

export function validateHandle(v: string): string | null {
  const t = v.trim()
  if (!t) return null
  if (t.startsWith("@")) return "leave out the @"
  if (/\s/.test(t)) return "no spaces in a handle"
  if (/^https?:\/\//i.test(t)) return "just the handle, not the link"
  return null
}

export function validateEmail(v: string): string | null {
  const t = v.trim()
  if (!t) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? null : "not a valid email address"
}

export function validateTimezone(v: string): string | null {
  const t = v.trim()
  if (!t) return null
  try {
    Intl.DateTimeFormat(undefined, { timeZone: t })
    return null
  } catch {
    return "use an IANA zone, e.g. Europe/London"
  }
}

export function validateImageUrl(v: string): string | null {
  const t = v.trim()
  if (!t) return null
  if (/^(https?:\/\/|ipfs:\/\/|ar:\/\/|data:image\/)/i.test(t)) return null
  if (/^eip155:\d+\/(erc721|erc1155):0x[0-9a-fA-F]{40}\/\d+$/.test(t)) return null
  return "use https://…, ipfs://…, ar://… or an NFT reference eip155:1/erc721:0x…/id"
}

export function validateText(v: string): string | null {
  return v.length > 2000 ? "keep it under 2000 characters" : null
}
