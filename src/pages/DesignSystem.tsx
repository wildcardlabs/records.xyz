import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Figure, FigSplit, Section, SectionHeader, Eyebrow, LivePill, StatusText, KeyChip,
  CellGrid, StatRow, LayerStack, Code, k, s, c, n, p, FaqRow,
} from "@/components/wrap"

const colors = [
  ["bg", "--bg", "paper"], ["bg-2", "--bg-2", "figure panels"], ["fg", "--fg", "ink"],
  ["fg-muted", "--fg-muted", "body"], ["fg-dim", "--fg-dim", "captions"], ["blue", "--blue", "ink, not paint"],
  ["blue-2", "--blue-2", "chart lines, lit cells"], ["yellow", "--yellow", "the one cta"], ["lilac", "--lilac", "key brackets, hover"],
  ["night", "--night", "hairline base"], ["ok", "--ok", "pass"], ["wait", "--wait", "pending"], ["err", "--err", "fail"],
]

export default function DesignSystem() {
  const [lit, setLit] = useState(6)
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="design system"
          title="Wrap, applied to records.xyz"
          lede="Lowercase mono on white graph paper. Hairline figure frames, dotted grids, square buttons, one electric blue and a highlighter-yellow call to action."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="blue">shadcn · base-nova</Badge>
          <Badge>tailwind v4</Badge>
          <Badge>azeret mono</Badge>
          <LivePill>live</LivePill>
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow="colour" title="Blue is ink, not paint" lede="It colours text and 1px outlines. It fills only the subnav, the blue button and one full-bleed band. Yellow appears on at most two buttons per page." />
        <Figure n={1} name="palette" padded={false} dotted={false}>
          <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4 lg:grid-cols-7">
            {colors.map(([name, v, note]) => (
              <div key={name} className="bg-paper p-3">
                <div className="h-10 border border-line" style={{ background: `var(${v})` }} />
                <div className="mt-2 text-[11px] font-semibold">{name}</div>
                <div className="t-caption normal-case tracking-normal">{note}</div>
              </div>
            ))}
          </div>
        </Figure>
      </Section>

      <Section>
        <SectionHeader eyebrow="type" title="One monospace, weight 500, tightly tracked" lede="Azeret Mono everywhere. Inter only for labels inside figures. Never bold above 600, never italic." />
        <Figure n={2} name="type scale" padded={false} dotted={false}>
          <div className="divide-y divide-line">
            {[
              ["t-display", "56 / 1.05 / -2px", "Put your accounts on the record"],
              ["t-h2", "34 / 1.3 / -2px", "Verified owned accounts, drawn as a figure"],
              ["t-h3", "18 / 600", "feature title, first letter capitalised"],
              ["t-lede", "13.5 / 1.65", "Taste tests, benchmarks, and self-improvement loops drive measurable crunch."],
              ["t-body", "13 / 1.65", "Body copy sits in warm grey so the ink headline carries the weight."],
              ["t-fig", "11.5 / 1.6", "figure copy: 0x4f3a…c91e · base · expires 2027-01-01"],
              ["t-label", "10 / 0.14em / upper", "layer 01 · kitchen.yaml · pass"],
              ["t-eyebrow", "11 / blue / lower", "# section name"],
            ].map(([cls, spec, sample]) => (
              <div key={cls} className="grid gap-2 px-4 py-4 sm:grid-cols-[140px_160px_1fr] sm:items-baseline">
                <code className="text-[11px] text-blue">.{cls}</code>
                <span className="t-caption normal-case tracking-normal">{spec}</span>
                <span className={cls}>{sample}</span>
              </div>
            ))}
          </div>
        </Figure>
      </Section>

      <Section>
        <SectionHeader eyebrow="buttons" title="Square, lowercase, 600. Hover recolours, never moves" />
        <Figure n={3} name="buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>primary</Button>
            <Button variant="outline">ghost outline</Button>
            <Button variant="accent">book a demo</Button>
            <Button variant="blue">blue</Button>
            <Button variant="ghost">ghost</Button>
            <Button variant="link">link</Button>
            <Button variant="destructive">remove</Button>
            <Button disabled>disabled</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm">small</Button>
            <Button size="lg" variant="accent">request early access</Button>
            <Button size="icon" variant="outline" aria-label="copy">⌗</Button>
            <Button variant="outline" onClick={() => toast.success("record published", { description: "3 accounts · 1 tx · 0.0021 eth" })}>toast</Button>
            <Dialog>
              <DialogTrigger render={<Button variant="outline">dialog</Button>} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="t-h3 lowercase">Publish 3 records?</DialogTitle>
                  <DialogDescription className="t-body">One transaction writes the listing and every proof to the resolver.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline">cancel</Button>
                  <Button variant="accent">publish</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Tooltip>
              <TooltipTrigger render={<Button variant="outline">tooltip</Button>} />
              <TooltipContent>expires 2027-01-01 · 412 days</TooltipContent>
            </Tooltip>
          </div>
          <div className="mt-6 band -mx-4 -mb-4 flex flex-wrap items-center gap-4 p-5 sm:-mx-5 sm:-mb-5">
            <span className="font-mono text-[12px]">inside the blue band / subnav:</span>
            <KeyChip k="L">line</KeyChip>
            <KeyChip k="T">taste loop</KeyChip>
            <Button variant="white" className="ml-auto">request early access</Button>
          </div>
        </Figure>
      </Section>

      <Section>
        <SectionHeader eyebrow="badges" title="Outlined rectangles, pills only for status" />
        <Figure n={4} name="badges · chips">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>pass</Badge>
            <Badge>best</Badge>
            <Badge variant="blue">eoa</Badge>
            <Badge variant="solid">safe</Badge>
            <Badge variant="dim">erc-6551</Badge>
            <Badge variant="pill">run #4821</Badge>
            <LivePill>live</LivePill>
            <LivePill tone="wait" pulse={false}>pending</LivePill>
            <LivePill tone="err" pulse={false}>expired</LivePill>
            <Badge variant="ok">verified</Badge>
            <Badge variant="wait">expiring</Badge>
            <Badge variant="err">invalid</Badge>
          </div>
        </Figure>
      </Section>

      <Section>
        <SectionHeader eyebrow="forms" title="Hairline inputs, dim uppercase labels" />
        <Figure n={5} name="form">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="name">ens name</Label>
              <Input id="name" placeholder="vitalik.eth" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acct">account</Label>
              <Input id="acct" placeholder="0x…" aria-invalid />
              <StatusText tone="err" className="text-[11px]">not a checksummed address</StatusText>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="auto" defaultChecked />
              <Label htmlFor="auto">remind me before expiry</Label>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="lit">lit cells</Label>
              <input id="lit" type="range" min={0} max={30} value={lit} onChange={(e) => setLit(Number(e.target.value))} className="accent-[var(--blue)]" />
              <span className="tabular text-[11px]">{lit}</span>
            </div>
          </div>
        </Figure>
      </Section>

      <Section>
        <SectionHeader eyebrow="figures" title="Every product visual is a numbered figure" lede="Frame, fig-bar, lavender dotted panel. Real-looking data inside: timestamps, chains, pass and fail." />
        <Figure n={6} name="hero · cell grid">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <CellGrid lit={lit} />
            <div className="flex flex-col items-end gap-2">
              <span className="t-label">accounts.yaml</span>
              <LivePill>live</LivePill>
            </div>
          </div>
          <StatRow className="mt-5" stats={[
            { label: "accounts", value: "7" },
            { label: "chains", value: "4" },
            { label: "verified", value: "6/7", hint: "1 expired" },
            { label: "next expiry", value: "41d", hint: "2026-12-01" },
          ]} />
        </Figure>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Figure n={7} name="run list" padded={false} dotted={false}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>time</TableHead><TableHead>account</TableHead><TableHead>chain</TableHead><TableHead>status</TableHead><TableHead className="text-right">expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["08/13 07:03", "0xd8da…6045", "mainnet", "ok", "verified", "2027-01-01"],
                  ["08/13 07:03", "0xb8c2…67d5", "base", "ok", "verified", "2027-01-01"],
                  ["08/12 22:41", "0x1f9a…0e3c", "optimism", "wait", "expiring", "2026-11-02"],
                  ["07/30 11:18", "0x77ab…91fe", "arbitrum", "err", "expired", "2026-10-01"],
                ].map((r) => (
                  <TableRow key={r[1]}>
                    <TableCell className="text-ink-dim">{r[0]}</TableCell>
                    <TableCell>{r[1]}</TableCell>
                    <TableCell>{r[2]}</TableCell>
                    <TableCell><StatusText tone={r[3] as "ok" | "wait" | "err"}>{r[4]}</StatusText></TableCell>
                    <TableCell className="text-right">{r[5]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Figure>

          <Figure n={8} name="quickstart" padded={false}>
            <Code lines={[
              [c("# accounts[8453] · base")],
              [k("name"), p(": "), s("alice.eth")],
              [k("chain"), p(": "), n("8453")],
              [k("accounts"), p(":")],
              [p("  - "), k("address"), p(": "), s("0xb8c2…67d5")],
              [p("    "), k("type"), p(": "), s("safe")],
              [p("    "), k("expires"), p(": "), n("1798761600"), p("  "), c("# 2027-01-01")],
              [p("  - "), k("address"), p(": "), s("0xd8da…6045")],
              [p("    "), k("type"), p(": "), s("eoa")],
            ]} />
          </Figure>
        </div>

        <Figure n={9} name="feature rail" className="mt-6" padded={false} dotted={false}>
          <FigSplit>
            <div className="divide-y divide-line">
              {[["01", "List", "Add any account on any chain."], ["02", "Consent", "Each account signs an EIP-712 consent."], ["03", "Publish", "One batch writes listing and proofs."]].map(([num, t, b], i) => (
                <button key={num} type="button" className={`hover-wash flex w-full gap-4 px-5 py-5 text-left ${i === 1 ? "wash" : ""}`}>
                  <span className="text-[12px] text-blue">{num}</span>
                  <span>
                    <span className="t-h3 block">{t}</span>
                    <span className="t-body block text-[12.5px]">{b}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="fig-body p-5">
              <LayerStack layers={[
                { label: "layer 01", title: "name", tags: ["ens"], copy: "alice.eth" },
                { label: "layer 02", title: "listing", tags: ["data"], copy: "accounts[8453]" },
                { label: "layer 03", title: "proof", tags: ["eip-712"], copy: "accounts[8453][0x…]" },
                { label: "layer 04", title: "verified", tags: ["erc-1271", "ecrecover"], copy: "6 of 7" },
              ]} />
            </div>
          </FigSplit>
        </Figure>
      </Section>

      <Section>
        <SectionHeader eyebrow="navigation" title="Tabs and faq rows" />
        <Figure n={10} name="tabs">
          <Tabs defaultValue="accounts">
            <TabsList>
              <TabsTrigger value="accounts">accounts</TabsTrigger>
              <TabsTrigger value="drafts">drafts</TabsTrigger>
              <TabsTrigger value="history">history</TabsTrigger>
            </TabsList>
            <TabsContent value="accounts" className="t-body">seven accounts across four chains.</TabsContent>
            <TabsContent value="drafts" className="t-body">two drafts waiting to be published.</TabsContent>
            <TabsContent value="history" className="t-body">no changes in the last 30 days.</TabsContent>
          </Tabs>
        </Figure>
        <div className="mt-8">
          <Eyebrow>faq</Eyebrow>
          <div className="mt-3 border-t border-line">
            <FaqRow q="is an owned account a payment address?" defaultOpen>No. The standard says clients must not send funds to owned accounts or show the name in place of the address.</FaqRow>
            <FaqRow q="can a proof be revoked?">Signatures cannot be revoked, so every proof carries an expiry of at most two years. Stop renewing to withdraw.</FaqRow>
          </div>
        </div>
      </Section>
    </>
  )
}
