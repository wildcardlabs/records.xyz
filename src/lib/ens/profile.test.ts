import { describe, expect, it } from "vitest"
import { canonicalKey, profileFromRecordSet } from "./profile"
import type { RecordSet } from "./recordset"

const set = (values: Record<string, string>): RecordSet => ({ values, source: "chain" }) as unknown as RecordSet

describe("keys people write", () => {
  it("maps aliases and capitalised keys to the standard record", () => {
    expect(canonicalKey("Avatar")).toBe("avatar")
    expect(canonicalKey("GitHub")).toBe("com.github")
    expect(canonicalKey("Website")).toBe("url")
    expect(canonicalKey("Twitter")).toBe("com.twitter")
    expect(canonicalKey("com.github")).toBe("com.github")
    expect(canonicalKey("Favourite colour")).toBeNull()
  })

  it("reads them into the profile and links full urls", () => {
    const p = profileFromRecordSet(set({ "text:Avatar": "https://pbs.twimg.com/a.jpg", "text:GitHub": "https://github.com/RWA-ID/x402card", "text:Website": "https://x-card.dev", "text:Mood": "sunny" }), "ai.xcard.eth", 1)
    expect(p.avatarUrl).toBe("https://pbs.twimg.com/a.jpg")
    expect(p.url).toBe("https://x-card.dev")
    expect(p.socials).toEqual([{ key: "com.github", label: "github", value: "RWA-ID/x402card", href: "https://github.com/RWA-ID/x402card" }])
    expect(p.other).toEqual([{ key: "Mood", value: "sunny" }])
  })

  it("lets the standard key win over an alias", () => {
    const p = profileFromRecordSet(set({ "text:url": "https://a.example", "text:Website": "https://b.example", "text:com.twitter": "@alice" }), "alice.eth", 1)
    expect(p.url).toBe("https://a.example")
    expect(p.socials[0]).toMatchObject({ value: "alice", href: "https://x.com/alice" })
  })
})
