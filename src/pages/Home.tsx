import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { normalize } from "viem/ens"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AccountsTable, type Row } from "@/components/record/AccountsTable"
import { Figure, FigSplit, Section, SectionHeader, Eyebrow, StatRow, StatusText, Code, k, s, c, n, p, FaqRow } from "@/components/wrap"

const steps = [
  {
    num: "01",
    title: "Add a wallet",
    body: "Any wallet or smart account you control, on any chain: a normal wallet, a Safe, a delegated wallet, a token-bound account.",
  },
  {
    num: "02",
    title: "Sign a consent",
    body: "That wallet signs a short message: \"I belong to alice.eth, until this date.\" Signing is free and nothing goes on chain yet.",
  },
  {
    num: "03",
    title: "Publish",
    body: "The wallet that owns the name writes every consent to the name in one transaction. From then on anyone can verify it.",
  },
]

const at = (iso: string) => BigInt(Math.floor(Date.parse(iso) / 1000))
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

  function go(e: React.FormEvent) {
    e.preventDefault()
    const raw = q.trim()
    if (!raw) return setErr("type an ENS name first, like alice.eth")
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
          lede="Prove which wallets belong to your ENS name. Each wallet signs its own consent, and anyone can check it live on chain. No indexer, no trust in us."
        />
        <form onSubmit={go} className="flex max-w-xl flex-col gap-2 sm:flex-row">
          <Input value={q} onChange={(e) => { setQ(e.target.value); setErr(null) }} placeholder="look up any ENS name, like alice.eth" aria-label="ens name" autoFocus />
          <Button type="submit" variant="accent" size="lg">open the record</Button>
        </form>
        {err ? <StatusText tone="err" className="mt-2 block text-[12px]">{err}</StatusText> : null}
        <div className="mt-3 text-[12px] text-ink-dim">
          see a live record: <Link className="link-blue text-ink" to="/steve.eth?net=sepolia">steve.eth</Link> on sepolia · or look up <Link className="link-blue text-ink" to="/vitalik.eth">vitalik.eth</Link>
        </div>

        <div className="mt-6 max-w-2xl border border-line bg-paper px-4 py-3 text-[12px]">
          <StatusText tone="wait">ENSv2 names only, for now.</StatusText>{" "}
          <span className="text-ink-muted">
            Publishing needs a resolver that can store data records, which ENSv2 resolvers do and today's mainnet public resolver does not. ENSv2 is live on Sepolia and comes to mainnet with the activation vote. Looking up any name works already.
          </span>
        </div>

        <Figure n={1} name="example · what a record looks like" className="mt-10" padded={false} dotted={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <span className="t-caption normal-case tracking-normal">a made-up alice.eth with five wallets: four still verified, one whose consent ran out</span>
            <Badge variant="dim">example</Badge>
          </div>
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
        <SectionHeader eyebrow="how it works" title="Three steps, one transaction" lede="Your ENS name already resolves to one address per chain for payments. This adds the rest of your wallets, each with a signed consent that proves it agreed." />
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
              <div className="t-caption px-4 pt-3 normal-case tracking-normal">under the hood: what ends up stored on the name</div>
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
        <SectionHeader eyebrow="verification" title="What verified means here" lede="Every check runs in your browser against public RPCs. records.xyz never holds the data and cannot fake a result." />
        <Figure n={3} name="checks" padded={false} dotted={false}>
          <Table>
            <TableHeader>
              <TableRow><TableHead>#</TableHead><TableHead>check</TableHead><TableHead>if it fails</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["1", "the name's list of accounts is well formed", "the list is ignored"],
                ["2", "a signed consent exists for the account", "unverified"],
                ["3", "the consent has not expired and is dated at most two years out", "expired / invalid"],
                ["4", "the signature is not empty", "invalid"],
                ["5", "smart accounts: the account itself confirms the signature (ERC-1271)", "invalid"],
                ["6", "wallets: the signature recovers to exactly this address (ecrecover)", "invalid"],
              ].map((r) => (
                <TableRow key={r[0]}>
                  <TableCell className="text-blue">{r[0]}</TableCell>
                  <TableCell className="whitespace-normal">{r[1]}</TableCell>
                  <TableCell><StatusText tone={r[2] === "unverified" ? "dim" : "err"}>{r[2]}</StatusText></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Figure>
      </Section>

      <Section>
        <Eyebrow>faq</Eyebrow>
        <div className="mt-3 border-t border-line">
          <FaqRow q="what do i need to get started?">An ENS name whose resolver can store data records. ENSv2 names qualify, on Sepolia today and on mainnet once ENSv2 is activated. Open your name's record page and it will tell you whether you are ready.</FaqRow>
          <FaqRow q="does it cost anything?">Signing a consent is free. Publishing is one normal transaction from the wallet that owns the name, so you pay gas once for all the wallets you add at the same time.</FaqRow>
          <FaqRow q="where are my signatures kept before i publish?">In your browser only. Sign with each wallet, then switch to the owner wallet in the same browser to publish. Nothing is uploaded to us. Signing from another person's device is not supported yet.</FaqRow>
          <FaqRow q="can i send money to an account listed here?">No. A listing says a wallet belongs to the name. It is not a payment address, and apps must never show the name in place of the address. Use the name's normal address records to pay it.</FaqRow>
          <FaqRow q="how do i remove a wallet?">The owner can remove it from the list at any time. The signed consent itself cannot be cancelled, which is why every consent has an expiry of at most two years. Pick a short window and let it lapse.</FaqRow>
          <FaqRow q="is this an official ENS standard?">It follows ENSIP-28, a draft standard from the ENS Labs protocol team. Drafts can change; records.xyz tracks it and keeps the format in one place so updates are quick.</FaqRow>
        </div>
      </Section>
    </>
  )
}
