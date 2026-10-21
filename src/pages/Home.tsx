import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { normalize } from "viem/ens"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Figure, FigSplit, Section, SectionHeader, Eyebrow, CellGrid, StatRow, LivePill, StatusText, Code, k, s, c, n, p, FaqRow } from "@/components/wrap"

const steps = [
  { num: "01", title: "List", body: "Add any account on any chain: an EOA, a Safe, a 7702 account, a token bound account." },
  { num: "02", title: "Consent", body: "The account itself signs an EIP-712 consent naming the name, the chain, itself and an expiry." },
  { num: "03", title: "Publish", body: "The name owner writes every listing and proof to the resolver in one transaction." },
]

export default function Home() {
  const [q, setQ] = useState("")
  const [err, setErr] = useState<string | null>(null)
  const nav = useNavigate()

  function go(e: React.FormEvent) {
    e.preventDefault()
    try {
      const name = normalize(q.trim())
      if (!name.includes(".")) throw new Error("enter a full name, like alice.eth")
      nav(`/${name}`)
    } catch (x) {
      setErr((x as Error).message.split("\n")[0].toLowerCase())
    }
  }

  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="ensip-28 · name owned accounts"
          title="Put your accounts on the record"
          lede="One ENS name, every account you control, verified from both sides. Each account signs its own consent; anyone can check it live from chain."
        />
        <form onSubmit={go} className="flex max-w-xl flex-col gap-2 sm:flex-row">
          <Input value={q} onChange={(e) => { setQ(e.target.value); setErr(null) }} placeholder="alice.eth" aria-label="ens name" autoFocus />
          <Button type="submit" variant="accent" size="lg">open the record</Button>
        </form>
        {err ? <StatusText tone="err" className="mt-2 block text-[12px]">{err}</StatusText> : null}
        <div className="mt-3 text-[12px] text-ink-dim">
          try <Link className="link-blue text-ink" to="/vitalik.eth">vitalik.eth</Link> · <Link className="link-blue text-ink" to="/nick.eth">nick.eth</Link>
        </div>

        <Figure n={1} name="a record" className="mt-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <CellGrid lit={7} />
            <div className="flex flex-col items-end gap-2">
              <span className="t-label">accounts[8453]</span>
              <LivePill>verified live</LivePill>
            </div>
          </div>
          <StatRow className="mt-5" stats={[
            { label: "accounts", value: "7" },
            { label: "chains", value: "4" },
            { label: "verified", value: "6/7", hint: "1 expired" },
            { label: "next expiry", value: "41d", hint: "2026-12-01" },
          ]} />
        </Figure>
      </Section>

      <Section>
        <SectionHeader eyebrow="how it works" title="Consent from both sides, stored as records" lede="ENSIP-9 maps one address per chain for payments. ENSIP-28 lists the rest of your accounts, each with a signed proof." />
        <Figure n={2} name="three steps" padded={false} dotted={false}>
          <FigSplit>
            <div className="divide-y divide-line">
              {steps.map((st) => (
                <div key={st.num} className="flex gap-4 px-5 py-5">
                  <span className="text-[12px] text-blue">{st.num}</span>
                  <span>
                    <span className="t-h3 block">{st.title}</span>
                    <span className="t-body block text-[12.5px]">{st.body}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="fig-body">
              <Code lines={[
                [c("# data records on alice.eth")],
                [k("accounts[8453]"), p(":          "), s("abi.encode(0xb8c2…, 0xd8da…)")],
                [k("accounts[8453][0xb8c2…]"), p(": "), s("abi.encode("), n("1798761600"), s(", sig)")],
                [k("accounts[8453][0xd8da…]"), p(": "), s("abi.encode("), n("1798761600"), s(", sig)")],
                [k("accounts-chains"), p(":         "), s("abi.encode("), n("1"), s(", "), n("8453"), s(")")],
                [p("")],
                [c("# consent (eip-712)")],
                [k("domain"), p(":  "), s("ENS Name Owned Accounts v1 · chainId 1")],
                [k("Consent"), p(": "), s("{ node, accountChainId, account, expiresAt }")],
              ]} />
            </div>
          </FigSplit>
        </Figure>
      </Section>

      <Section>
        <SectionHeader eyebrow="verification" title="What this page checks before it says verified" lede="Everything runs in your browser against public RPCs. No indexer, no trust in records.xyz." />
        <Figure n={3} name="checks" padded={false} dotted={false}>
          <Table>
            <TableHeader>
              <TableRow><TableHead>#</TableHead><TableHead>check</TableHead><TableHead>on failure</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["1", "listing decodes into whole 32-byte address words", "listing ignored"],
                ["2", "a proof record exists for the account", "unverified"],
                ["3", "expiresAt is non-zero, in the future, and at most two years ahead", "expired / invalid"],
                ["4", "signature is non-empty", "invalid"],
                ["5", "account has code → ERC-1271 isValidSignature returns 0x1626ba7e", "invalid"],
                ["6", "otherwise ecrecover equals the account and is not zero", "invalid"],
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
          <FaqRow q="is an owned account a payment address?">No. The standard is explicit: owned accounts are not payment addresses. Clients must not show the name in place of the address, and should not send funds to them.</FaqRow>
          <FaqRow q="who can publish?">Only the name owner (or a manager the resolver authorises) can write records. Anyone can sign a consent for an account they control; the owner publishes it.</FaqRow>
          <FaqRow q="can a proof be revoked?">Signatures cannot be revoked, so every proof carries an expiry of at most two years. Pick a short window and stop renewing to withdraw. ERC-1271 proofs also lapse when a contract account's signers rotate.</FaqRow>
          <FaqRow q="which resolvers work?">Any resolver implementing ENSIP-24 data records (interface 0xecbfada3). The record page tells you when a name's resolver does not.</FaqRow>
          <FaqRow q="is this standard final?">ENSIP-28 is a draft. records.xyz tracks it closely; keys, encodings and the consent struct live in one module so a revision is a small change.</FaqRow>
        </div>
      </Section>
    </>
  )
}
