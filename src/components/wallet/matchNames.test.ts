import { describe, expect, it } from "vitest"
import { matchNames } from "./MyNames"
import type { MyName } from "@/lib/ens/names"

const n = (name: string): MyName => ({ name, chainId: 1, relations: ["owner"], authority: null, isPrimary: false, expiresAt: null, renewBy: null })
const names = ["alice.eth", "alicia.eth", "bob.eth", "malice.eth", "steve.eth"].map(n)

describe("matchNames", () => {
  it("ranks exact, then prefix, then substring", () => {
    expect(matchNames(names, "alice").map((x) => x.name)).toEqual(["alice.eth", "malice.eth"])
    expect(matchNames(names, "ali").map((x) => x.name)).toEqual(["alice.eth", "alicia.eth", "malice.eth"])
  })
  it("returns the head of the list for an empty needle and respects the limit", () => {
    expect(matchNames(names, "", 2).map((x) => x.name)).toEqual(["alice.eth", "alicia.eth"])
  })
})
