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
import { Figure, FigSplit, Section, SectionHeader, Eyebrow, StatRow, StatusText, FaqRow } from "@/components/wrap"

const steps = [
  { num: "01", title: "Add a wallet", body: "Any wallet or smart account you control, on any chain." },
  { num: "02", title: "Sign a consent", body: "The wallet signs a message naming alice.eth and an expiry date." },
  { num: "03", title: "Publish", body: "The owner publishes the signatures to the name. Anyone can check them." },
]

const features = [
  { num: "01", title: "Profile", body: "Avatar, bio, links and content hash." },
  { num: "02", title: "Payment addresses", body: "One address per chain or coin, with a default for every EVM chain." },
  { num: "03", title: "Wallets on the record", body: "Wallets that signed to say they belong to the name, checked onchain." },
  { num: "04", title: "Primary name", body: "The name your wallet shows as, on mainnet, base, optimism and arbitrum." },
  { num: "05", title: "Shared profile", body: "Several names use one profile. Edit it once." },
  { num: "06", title: "Who can edit", body: "Let another wallet edit some or all of the records." },
  { num: "07", title: "History", body: "Every change to the name, newest first." },
  { num: "08", title: "Any wallet's names", body: "Look up an address to see the names it owns or manages." },
  { num: "09", title: "Renew", body: "Extend any .eth name by budget or by years. Pay in USDC or DAI." },
]

const support = [
  { what: "profile, payment addresses, primary name", where: "ENSv1 and ENSv2" },
  { what: "wallets on the record", where: "ENSv2" },
  { what: "shared profile, who can edit", where: "ENSv2" },
  { what: "history, any wallet's names", where: "every name" },
  { what: "renew", where: "every .eth name" },
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
          eyebrow="ens records · mainnet · ensv1 and ensv2"
          title="Put your accounts on the record"
          lede="Every ENS name's records on one page. Read any name, edit the ones you own, prove which wallets are yours, and renew by budget or by duration."
        />
        <form onSubmit={go} className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-stretch">
          <Input value={q} onChange={(e) => { setQ(e.target.value); setErr(null) }} placeholder="look up any ENS name or wallet address" aria-label="ens name" autoFocus />
          <Button type="submit" variant="accent" className="h-10 px-5 tracking-[.02em]">open the record</Button>
        </form>
        {err ? <StatusText tone="err" className="mt-2 block text-[12px]">{err}</StatusText> : null}
        <div className="mt-3 text-[12px] text-ink-dim">
          {isConnected && mine.data && mine.data.names.length > 0 ? (
            <>
              <Link className="link-blue text-ink" to="/account">account</Link> · {mine.data.names.length} names
              <span className="mx-2">·</span>
            </>
          ) : null}
          try <Link className="link-blue text-ink" to="/nick.eth">nick.eth</Link> or <Link className="link-blue text-ink" to="/vitalik.eth">vitalik.eth</Link>
        </div>


        <Figure n={1} name="example · a record page" className="mt-10" padded={false} dotted={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <span className="t-caption inline-flex items-center gap-2 normal-case tracking-normal"><VerifiedSeal className="size-3.5 text-ok" /> alice.eth is made up</span>
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
        <SectionHeader eyebrow="what you can do" title="One page for the whole name" />
        <Figure n={2} name="what a record page holds" padded={false} dotted={false}>
          <div className="grid divide-y divide-line sm:grid-cols-2 lg:grid-cols-3 sm:[&>*:nth-child(odd)]:border-r sm:[&>*]:border-line lg:[&>*:nth-child(odd)]:border-r-0 lg:[&>*:not(:nth-child(3n))]:border-r">
            {features.map((f) => (
              <div key={f.num} className="p-5">
                <div className="flex items-baseline gap-3">
                  <span className="text-[11px] text-blue">{f.num}</span>
                  <span className="t-fig-title">{f.title}</span>
                </div>
                <p className="t-fig-body mt-2">{f.body}</p>
              </div>
            ))}
          </div>
        </Figure>
      </Section>

      <Section>
        <SectionHeader eyebrow="wallets on the record" title="Three steps, one transaction" lede="Any wallet you control can sign to say it belongs to your name." />
        <Figure n={3} name="how a wallet gets on the record" padded={false} dotted={false}>
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
            <div>
              <div className="t-caption px-5 pt-4 normal-case tracking-normal">what works where</div>
              <div className="divide-y divide-line">
                {support.map((r) => (
                  <div key={r.what} className="flex items-baseline justify-between gap-4 px-5 py-3">
                    <span className="t-fig-body">{r.what}</span>
                    <span className="shrink-0 text-[11px] text-ink-muted">{r.where}</span>
                  </div>
                ))}
              </div>
            </div>
          </FigSplit>
        </Figure>
      </Section>

      <Section>
        <Eyebrow>faq</Eyebrow>
        <div className="mt-3 border-t border-line">
          <FaqRow q="what do i need?">An ENS name on mainnet. Wallets on the record, shared profiles and access need it on ENSv2.</FaqRow>
          <FaqRow q="does it cost anything?">Reading and signing are free. Publishing is one transaction.</FaqRow>
          <FaqRow q="can i edit a name i don't own?">Only if the owner gave your wallet access.</FaqRow>
          <FaqRow q="how is a wallet verified?">The signature stored on the name must come from that wallet and not have expired. Smart accounts are checked with ERC-1271.</FaqRow>
          <FaqRow q="where are my signatures kept before i publish?">In this browser, until the owner publishes them.</FaqRow>
          <FaqRow q="can i send money to a wallet on the record?">No. Use the name's payment addresses. A wallet on the record only says it belongs to the name.</FaqRow>
          <FaqRow q="how do i remove a wallet?">The owner removes it and publishes. A signature can't be cancelled, only expire, so keep expiries short.</FaqRow>
          <FaqRow q="which standards does this follow?">Standard ENS records and primary names, plus <a className="link-blue text-ink" href="https://docs.ens.domains/ensip/28/" target="_blank" rel="noreferrer">ENSIP-28</a>, a draft, for wallets on the record. Shared profiles and access are ENSv2 resolver features.</FaqRow>
        </div>
      </Section>
    </>
  )
}
