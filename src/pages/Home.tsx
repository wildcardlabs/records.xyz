import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { normalize } from "viem/ens"
import { getAddress, isAddress } from "viem"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useConnection } from "wagmi"
import { useMyNames } from "@/hooks/useMyNames"
import { Badge } from "@/components/ui/badge"
import { AccountsTable, type Row } from "@/components/record/AccountsTable"
import { ProfileCard } from "@/components/record/ProfileCard"
import { VerifiedSeal } from "@/components/record/StatusMark"
import { type Profile, coinTypeFor } from "@/lib/ens/profile"
import { COIN_TYPE_DEFAULT } from "@/lib/records"
import { Figure, FigSplit, Section, SectionHeader, Eyebrow, StatRow, StatusText, Code, k, s, c, n, p, FaqRow } from "@/components/wrap"

const steps = [
  {
    num: "01",
    title: "Add a wallet",
    body: "Any wallet or smart account you control, on any chain.",
  },
  {
    num: "02",
    title: "Sign a consent",
    body: "It signs one line: \"I belong to alice.eth, until this date.\" Free, and nothing goes onchain yet.",
  },
  {
    num: "03",
    title: "Publish",
    body: "The owner writes every consent in one transaction. From then on anyone can verify it.",
  },
]

const at = (iso: string) => BigInt(Math.floor(Date.parse(iso) / 1000))
// example art from DiceBear (https://www.dicebear.com), coloured with the site palette
const DICEBEAR = "https://api.dicebear.com/10.x"
const exampleAvatar = `${DICEBEAR}/voxel-art/svg?seed=alice.eth&tags=animation&backgroundColor=eef17c&hairColor=7267ff&shirtColor=2a1eff&jacketColor=0d0a3d&hatColor=0d0a3d&shoesColor=0d0a3d`
const exampleBanner = `${DICEBEAR}/weave/svg?seed=alice.eth&backgroundColor=f6f5fb&colorAColor=2a1eff&colorBColor=7267ff&colorCColor=b7a4f2&lineColor=0d0a3d`
const exampleProfile: Profile = {
  displayName: null,
  location: null,
  contenthash: "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
  avatar: exampleAvatar,
  avatarUrl: exampleAvatar,
  header: exampleBanner,
  theme: "#0d0a3d",
  description: "designer · building on ethereum",
  url: "https://alice.xyz",
  socials: [
    { key: "com.twitter", label: "x", value: "alice", href: "https://x.com/alice" },
    { key: "com.github", label: "github", value: "alice", href: "https://github.com/alice" },
  ],
  addresses: [
    { coinType: COIN_TYPE_DEFAULT, label: "any evm chain", isDefault: true, address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", evm: true },
    { coinType: coinTypeFor(8453), label: "base", isDefault: false, address: "0xb8c2C29ee19D8307cb7255e1Cd9CbDE883A267d5", evm: true },
    { coinType: coinTypeFor(10), label: "optimism", isDefault: false, address: "0x77ab1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f91fe", evm: true },
    { coinType: 0, label: "btc", isDefault: false, address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", evm: false },
  ],
  fallbackChains: ["arbitrum"],
  source: "chain",
}
const example: Row[] = [
  { chainId: 1, account: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", kind: "eoa", status: "verified", reason: "example", expiresAt: at("2027-01-01") },
  { chainId: 1, account: "0x9a6b3f1c0e2d4b5a6c7d8e9f0a1b2c3d4e5f31c0", kind: "contract", status: "verified", reason: "example", expiresAt: at("2027-06-30") },
  { chainId: 8453, account: "0xb8c2C29ee19D8307cb7255e1Cd9CbDE883A267d5", kind: "contract", status: "verified", reason: "example", expiresAt: at("2026-12-01") },
  { chainId: 8453, account: "0x41e0a1b2c3d4e5f60718293a4b5c6d7e8f908a2f", kind: "7702", status: "verified", reason: "example", expiresAt: at("2027-03-15") },
  { chainId: 10, account: "0x77ab1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f91fe", kind: "eoa", status: "expired", reason: "example", expiresAt: at("2026-10-01") },
]
export default function Home() {
  const [q, setQ] = useState("")
  const [err, setErr] = useState<string | null>(null)
  const nav = useNavigate()
  const { address, isConnected } = useConnection()
  const mine = useMyNames(address)

  function go(e: React.FormEvent) {
    e.preventDefault()
    const raw = q.trim()
    if (!raw) return setErr("type an ENS name or a wallet address first")
    if (isAddress(raw)) return nav(`/${getAddress(raw)}`)
    try {
      const name = normalize(raw)
      if (!name.includes(".")) throw new Error("that is not a full name. include the ending, like alice.eth")
      nav(`/${name}`)
    } catch (x) {
      const msg = (x as Error).message.split("\n")[0]
      setErr(msg.startsWith("that is not") ? msg : `"${raw}" is not a valid ENS name`)
    }
  }

  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="built on ensip-28 · name owned accounts"
          title="Put your accounts on the record"
          lede="Prove which wallets belong to your ENS name. Each wallet signs its own consent, and anyone can check it live onchain."
        />
        <form onSubmit={go} className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-stretch">
          <Input value={q} onChange={(e) => { setQ(e.target.value); setErr(null) }} placeholder="look up any ENS name or wallet address" aria-label="ens name" autoFocus />
          <Button type="submit" variant="accent" className="h-10 px-5 tracking-[.02em]">open the record</Button>
        </form>
        {err ? <StatusText tone="err" className="mt-2 block text-[12px]">{err}</StatusText> : null}
        <div className="mt-3 text-[12px] text-ink-dim">
          {isConnected && mine.data && mine.data.names.length > 0 ? (
            <>
              <Link className="link-blue text-ink" to="/names">your names</Link> · {mine.data.names.length} found
              <span className="mx-2">·</span>
            </>
          ) : null}
          see a live record: <Link className="link-blue text-ink" to="/nick.eth">nick.eth</Link> on ENSv2 · or look up <Link className="link-blue text-ink" to="/vitalik.eth">vitalik.eth</Link>
        </div>


        <Figure n={1} name="example · a record page" className="mt-10" padded={false} dotted={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <span className="t-caption inline-flex items-center gap-2 normal-case tracking-normal"><VerifiedSeal className="size-3.5 text-ok" /> a made-up alice.eth · the seal marks a payment address whose wallet also consented below</span>
            <Badge variant="dim">example</Badge>
          </div>
          <ProfileCard
            name="alice.eth"
            profile={exampleProfile}
            loading={false}
            consented={(coinType, address) => example.some((r) => r.status === "verified" && r.account.toLowerCase() === address.toLowerCase() && (coinType === COIN_TYPE_DEFAULT || (coinType === 60 ? r.chainId === 1 : coinTypeFor(r.chainId) === coinType)))}
          />
          <div className="border-t border-line" />
          <AccountsTable rows={example} canEdit={false} />
          <StatRow className="border-t border-line" stats={[
            { label: "on the record", value: "5" },
            { label: "verified", value: "4/5", hint: "1 expired" },
            { label: "chains", value: "3" },
            { label: "next expiry", value: "41 days", hint: "2026-12-01" },
          ]} />
        </Figure>
      </Section>

      <Section>
        <SectionHeader eyebrow="how it works" title="Three steps, one transaction" lede="Your name already resolves to one address per chain. This adds the rest of your wallets, each with a signed consent." />
        <Figure n={2} name="how it works" padded={false} dotted={false}>
          <FigSplit>
            <div className="divide-y divide-line">
              {steps.map((st) => (
                <div key={st.num} className="flex gap-4 px-5 py-4">
                  <span className="text-[11px] text-blue">{st.num}</span>
                  <span>
                    <span className="t-fig-title block">{st.title}</span>
                    <span className="t-fig-body block">{st.body}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="fig-body">
              <div className="t-caption px-4 pt-3 normal-case tracking-normal">what ends up stored on the name</div>
              <Code lines={[
                [c("# data records on alice.eth")],
                [k("accounts[8453]"), p(":          "), s("abi.encode(0xb8c2…, 0xd8da…)")],
                [k("accounts[8453][0xb8c2…]"), p(": "), s("abi.encode("), n("1798761600"), s(", sig)")],
                [k("accounts[8453][0xd8da…]"), p(": "), s("abi.encode("), n("1798761600"), s(", sig)")],
                [k("accounts-chains"), p(":         "), s("abi.encode("), n("1"), s(", "), n("8453"), s(")")],
                [p("")],
                [c("# the message each wallet signs (eip-712)")],
                [k("domain"), p(":  "), s("ENS Name Owned Accounts v1 · chainId 1")],
                [k("Consent"), p(": "), s("{ node, accountChainId, account, expiresAt }")],
              ]} />
            </div>
          </FigSplit>
        </Figure>
      </Section>

      <Section>
        <SectionHeader eyebrow="one page" title="One page for the whole name" lede="Profile, payment addresses and the wallets on the record, each published from where it is edited." />
        <Figure n={3} name="what a record page holds" padded={false} dotted={false}>
          <div className="grid divide-y divide-line lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {[
              { num: "01", title: "Profile and payment addresses", body: "Avatar, bio, links, an address for any chain or coin, the content hash. Edit on any name you own." },
              { num: "02", title: "Wallets on the record", body: "Every wallet that has signed to say it belongs to the name, verified from that signature. Needs the name on ENSv2." },
              { num: "03", title: "Shared profile and access", body: "On ENSv2, several names can use one profile, and a teammate or an agent can edit one record without owning the name." },
            ].map((c) => (
              <div key={c.num} className="p-5">
                <div className="flex items-baseline gap-3">
                  <span className="text-[11px] text-blue">{c.num}</span>
                  <span className="t-fig-title">{c.title}</span>
                </div>
                <p className="t-fig-body mt-2">{c.body}</p>
              </div>
            ))}
          </div>
        </Figure>
      </Section>

      <Section>
        <Eyebrow>faq</Eyebrow>
        <div className="mt-3 border-t border-line">
          <FaqRow q="what do i need to get started?">Any ENS name. Wallets on the record, shared profiles and per-key access need the name on ENSv2, which is live on mainnet: upgrade it in the ENS app.</FaqRow>
          <FaqRow q="does it cost anything?">Signing is free. Publishing is one normal transaction from the owner wallet.</FaqRow>
          <FaqRow q="how is a consent verified?">In your browser, from chain: the consent must be unexpired and dated at most two years out, and the signature must recover to the wallet (ecrecover) or be confirmed by the account itself (ERC-1271).</FaqRow>
          <FaqRow q="where are my signatures kept before i publish?">In your browser only. Sign with each wallet, then publish from the owner wallet in the same browser.</FaqRow>
          <FaqRow q="can i send money to a wallet on the record?">No. It is an identity claim, not a payment address. Pay the name's address records.</FaqRow>
          <FaqRow q="how do i remove a wallet?">The owner removes it from the list. The consent itself cannot be cancelled, only left to expire, so pick short windows.</FaqRow>
          <FaqRow q="is this an official ENS standard?">It follows ENSIP-28, a draft from the ENS Labs protocol team. Drafts change; records.xyz tracks it.</FaqRow>
        </div>
      </Section>
    </>
  )
}
