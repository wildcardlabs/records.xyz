import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowRight, BadgePercent, Copy, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { type Hex, erc20Abi, pad } from "viem"
import { normalize } from "viem/ens"
import { useConnection, useReadContract, useSendTransaction, useSwitchChain } from "wagmi"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConnectButton } from "@/components/wallet/ConnectButton"
import { FaqRow, FigSplit, Figure, Pager, Section, SectionHeader, StatusText, V2, usePager } from "@/components/wrap"
import { useMyNames } from "@/hooks/useMyNames"
import { renewInfoKey, useRenewInfo, useRenewQuote, useRentPricing } from "@/hooks/useRenew"
import { publicClient } from "@/lib/ens/clients"
import { PAY_TOKENS, type PayToken, type Pricing, YEAR, ceilToCent, fmtDollars, fmtDuration, fmtToken, isEthSecondLevel, parseDollars, priceFor, renewCalls, solveBudget, tierFor, tiers, yearsToSeconds } from "@/lib/ens/renew"
import { daysUntil, fmtDate, shortAddr } from "@/lib/format"
import { asChainId } from "@/lib/wagmi"

const MAINNET = 1
const QUICK_YEARS = [1, 2, 3, 6]
/** records.xyz is the referrer on every renewal it sends: the address, left-padded to 32 bytes */
const REFERRER: Hex = pad("0x1208a26FAa0F4AC65B42098419EB4dAA5e580AC6", { size: 32 })

type Mode = "budget" | "duration"
type DurationKind = "years" | "date"

/**
 * Extend any .eth name. Pick the name, then either a term (the price follows) or a budget
 * (the term follows), pay in USDC or DAI. Both paths read the registrar's own price before
 * anything is signed, so what is shown is what is charged.
 */
export default function RenewPage() {
  const { name: given } = useParams<{ name?: string }>()
  const nav = useNavigate()
  const { address, isConnected, chainId: walletChainId } = useConnection()
  const [typed, setTyped] = useState(given ?? "")
  const name = useMemo(() => {
    const raw = typed.trim().toLowerCase()
    if (!raw.includes(".")) return null
    try {
      return normalize(raw)
    } catch {
      return null
    }
  }, [typed])

  useEffect(() => {
    if (name && name !== given) nav(`/renew/${name}`, { replace: true })
  }, [name, given, nav])

  const info = useRenewInfo(name)
  const label = info.data?.label
  const renewable = !!info.data?.renewer && (info.data.status === "registered" || info.data.status === "grace")
  const [mode, setMode] = useState<Mode>("budget")
  const [token, setToken] = useState<PayToken>(PAY_TOKENS[0])
  const pricing = useRentPricing(token.address)
  const [years, setYears] = useState("1")
  const [untilDate, setUntilDate] = useState("")
  const [durKind, setDurKind] = useState<DurationKind>("years")
  const [usd, setUsd] = useState<string | null>(null)

  // the budget starts at the six-year entry price for this name, the point where a dollar buys the most time
  const defaultUsd = useMemo(() => {
    if (!pricing.data) return ""
    const best = tiers(pricing.data)[0]
    const cost = priceFor(pricing.data, label && renewable ? label : "alice", best.start)
    return cost > 0n ? fmtToken(ceilToCent(cost, token.decimals), token.decimals) : ""
  }, [pricing.data, label, renewable, token.decimals])
  const usdText = usd ?? defaultUsd
  const budgetAmount = parseDollars(usdText, token.decimals)
  // ens-budget's solver, run locally on every change so the slider and cards answer at once
  const solution = useMemo(() => (mode === "budget" && pricing.data && label && budgetAmount !== null ? solveBudget(pricing.data, label, budgetAmount) : null), [mode, pricing.data, label, budgetAmount])

  const wantedSeconds = useMemo(() => {
    if (mode === "duration") {
      if (durKind === "date") {
        const target = Date.parse(`${untilDate}T00:00:00Z`)
        if (!Number.isFinite(target) || !info.data?.expiry) return 0n
        const s = BigInt(Math.floor(target / 1000)) - info.data.expiry
        return s > 0n && s <= 100n * YEAR ? s : 0n
      }
      const y = Number(years)
      return Number.isFinite(y) && y > 0 ? yearsToSeconds(Math.min(y, 100)) : 0n
    }
    return solution?.duration ?? 0n
  }, [mode, years, durKind, untilDate, info.data?.expiry, solution])
  // the contract-confirmed quote: ens-budget's quoteRenewal for a budget, getRenewPrice for a term
  const quote = useRenewQuote(
    mode === "budget" ? { mode, label, token: token.address, budget: budgetAmount } : { mode, label, token: token.address, renewer: info.data?.renewer ?? null, duration: wantedSeconds, pricing: pricing.data },
    renewable
  )
  const seconds = quote.data?.duration ?? wantedSeconds
  const amount = quote.data?.amount
  const tier = pricing.data && seconds > 0n ? tierFor(pricing.data, seconds) : null
  // the next tier up, when it is within reach of the budget
  const offer = useMemo(() => {
    const n = solution?.nextTier
    if (!n || !renewable || budgetAmount === null || budgetAmount <= 0n) return null
    if (Number(n.extraAmount) > Number(budgetAmount) * 0.35) return null
    const t = pricing.data ? tierFor(pricing.data, n.duration) : null
    return { years: t?.years ?? 0, off: n.discountBps / 100, cost: ceilToCent(n.amount, token.decimals), extraAmount: n.extraAmount, extraDuration: n.extraDuration }
  }, [solution, renewable, budgetAmount, pricing.data, token.decimals])
  const perYear = amount && seconds > 0n ? (amount * YEAR) / seconds : null

  // wallet side: balance and allowance for the chosen token
  const balance = useReadContract({ address: token.address, abi: erc20Abi, functionName: "balanceOf", args: address ? [address] : undefined, chainId: MAINNET, query: { enabled: !!address } })
  const allowance = useReadContract({ address: token.address, abi: erc20Abi, functionName: "allowance", args: address && info.data?.renewer ? [address, info.data.renewer] : undefined, chainId: MAINNET, query: { enabled: !!address && !!info.data?.renewer } })
  const enough = amount !== undefined && balance.data !== undefined && balance.data >= amount
  const approved = amount !== undefined && allowance.data !== undefined && allowance.data >= amount

  const { switchChainAsync } = useSwitchChain()
  const { sendTransactionAsync } = useSendTransaction()
  const qc = useQueryClient()
  const [phase, setPhase] = useState<"idle" | "approving" | "extending">("idle")
  const [done, setDone] = useState<{ hash: Hex; seconds: bigint; name: string } | null>(null)

  async function extend() {
    const q = quote.data
    if (!address || !q || q.amount <= 0n || q.duration <= 0n) return
    try {
      if (walletChainId !== MAINNET) await switchChainAsync({ chainId: asChainId(MAINNET) })
      // ens-budget builds the calls: an approval for exactly the quoted amount when the allowance is short, then the renewal
      const calls = await renewCalls(publicClient(MAINNET), q, address, REFERRER)
      let hash: Hex = "0x"
      for (const [i, call] of calls.entries()) {
        const isApproval = calls.length === 2 && i === 0
        setPhase(isApproval ? "approving" : "extending")
        hash = await sendTransactionAsync({ to: call.to, data: call.data, chainId: asChainId(MAINNET) })
        toast(isApproval ? "approval sent" : "transaction sent", { description: shortAddr(hash, 8) })
        const receipt = await publicClient(MAINNET).waitForTransactionReceipt({ hash })
        if (receipt.status !== "success") throw new Error(`transaction ${shortAddr(hash, 6)} reverted`)
        if (isApproval) allowance.refetch()
      }
      setDone({ hash, seconds: q.duration, name: name! })
      toast.success(`${name} extended`, { description: fmtDuration(q.duration) })
      qc.invalidateQueries({ queryKey: renewInfoKey(name!) })
      qc.invalidateQueries({ queryKey: ["my-names"] })
      balance.refetch()
      allowance.refetch()
    } catch (e) {
      toast.error("could not extend", { description: (e as Error).message?.split("\n")[0]?.slice(0, 140) })
    } finally {
      setPhase("idle")
    }
  }

  const busy = phase !== "idle"
  const canPay = renewable && !!amount && amount > 0n && isConnected && enough && !busy && !quote.isFetching
  const payLabel = phase === "approving" ? `approving ${token.symbol}…` : phase === "extending" ? "confirm in wallet…" : !approved && amount ? `approve ${token.symbol} and extend` : "extend"

  return (
    <Section>
      <SectionHeader eyebrow="renew" title="Extend a name" lede="Any wallet can extend any .eth name. Longer terms cost less per year." />

      <Figure n={1} name={`extend · ${name ?? "…"}`} padded={false} dotted={false}>
        {/* ------------------------------------------------------------ the name */}
        <div className="border-b border-line p-4 sm:p-5">
          <Label htmlFor="renew-name">name</Label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input id="renew-name" className="sm:max-w-md" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="alice.eth" autoFocus={!given} />
            <YourNamesPicker current={name} onPick={(n) => setTyped(n)} />
            {name ? (
              <Button variant="outline" render={<Link to={`/${name}`} />}>
                <ExternalLink data-icon="inline-start" /> open record
              </Button>
            ) : null}
            {name ? (
              <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/renew/${name}`); toast("link copied") }}>
                <Copy data-icon="inline-start" /> copy link
              </Button>
            ) : null}
          </div>
          <p className="t-caption mt-3 normal-case tracking-normal">
            <NameStatus typed={typed} name={name} info={info} />
          </p>
        </div>

        <FigSplit>
          {/* ------------------------------------------------------------ what to buy */}
          <div className="p-4 sm:p-5">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="budget">by budget</TabsTrigger>
                <TabsTrigger value="duration">by duration</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* both panels share one grid cell: the hidden one still takes space, so the height never jumps between tabs */}
            <div className="grid [&>*]:[grid-area:1/1]">
              <div className={mode === "budget" ? undefined : "invisible"} inert={mode !== "budget"} aria-hidden={mode !== "budget"}>
                <BudgetPicker usdText={usdText} setUsd={setUsd} budgetAmount={budgetAmount} decimals={token.decimals} pricing={pricing.data} label={label} ready={renewable} offer={offer} activeYears={tier?.years ?? 0} />
              </div>
              <div className={mode === "duration" ? undefined : "invisible"} inert={mode !== "duration"} aria-hidden={mode !== "duration"}>
              <div className="mt-5">
                <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                  <div>
                    <Label htmlFor="renew-years">years</Label>
                    <Input id="renew-years" inputMode="decimal" className={`t-h3 mt-2 h-12 w-[9rem] ${durKind === "date" ? "text-ink-dim" : ""}`} value={durKind === "date" && seconds > 0n ? (Number(seconds) / Number(YEAR)).toFixed(2) : years} onChange={(e) => { setDurKind("years"); setYears(e.target.value) }} onFocus={() => setDurKind("years")} aria-invalid={durKind === "years" && wantedSeconds === 0n} />
                  </div>
                  <span className="t-caption pb-4 normal-case tracking-normal">or until</span>
                  <div>
                    <Label htmlFor="renew-until">new expiry date</Label>
                    <Input id="renew-until" type="date" className={`mt-2 h-12 w-[11rem] ${durKind === "years" ? "text-ink-dim" : ""}`} min={info.data?.expiry ? fmtDate(info.data.expiry + 86_400n) : undefined} value={durKind === "date" ? untilDate : info.data?.expiry && seconds > 0n ? fmtDate(info.data.expiry + seconds) : ""} onChange={(e) => { setDurKind("date"); setUntilDate(e.target.value) }} onFocus={() => setDurKind("date")} aria-invalid={durKind === "date" && untilDate !== "" && wantedSeconds === 0n} />
                  </div>
                </div>
                {durKind === "date" && untilDate && wantedSeconds === 0n && info.data?.expiry ? <p className="t-caption mt-2 normal-case tracking-normal"><StatusText tone="err">pick a date after {fmtDate(info.data.expiry)}.</StatusText></p> : null}
                <TierCards
                  items={QUICK_YEARS.map((y) => ({ years: y, off: pricing.data ? tierFor(pricing.data, yearsToSeconds(y)).off : 0 }))}
                  activeYears={durKind === "years" && QUICK_YEARS.includes(Number(years)) ? Number(years) : -1}
                  onPick={(y) => { setDurKind("years"); setYears(String(y)) }}
                />
              </div>
              </div>
            </div>

            <div className="mt-6">
              <Label>pay with</Label>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                {PAY_TOKENS.map((t) => (
                  <button key={t.symbol} type="button" onClick={() => setToken(t)} className={`border px-2 py-0.5 ${token.symbol === t.symbol ? "border-blue text-blue" : "border-line text-ink-muted hover:border-blue hover:text-blue"}`}>
                    {t.symbol}
                  </button>
                ))}
                {address && balance.data !== undefined ? <span className="ml-2 text-ink-dim">you have {fmtToken(balance.data, token.decimals)} {token.symbol}</span> : null}
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------ what you get */}
          <div className="flex flex-col p-4 sm:p-5">
            <Label>{mode === "budget" ? "buys" : "costs"}</Label>
            <div className="t-h2 mt-2 text-ink">
              {!renewable ? <span className="text-ink-dim">—</span> : mode === "budget" ? fmtDuration(seconds) : amount !== undefined ? `${fmtToken(amount, token.decimals)} ${token.symbol}` : "…"}
            </div>
            <dl className="mt-4 divide-y divide-line text-[12.5px]">
              <Row k="new expiry" v={renewable && info.data?.expiry && seconds > 0n ? fmtDate(info.data.expiry + seconds) : "—"} />
              {mode === "budget" ? <Row k="price" v={amount !== undefined && renewable ? `${fmtToken(amount, token.decimals)} ${token.symbol}` : "—"} /> : <Row k="term" v={renewable && seconds > 0n ? fmtDuration(seconds) : "—"} />}
              <Row k="rate" v={tier && renewable ? (tier.off ? `${tier.off}% off · ${tier.years}+ years` : "standard") : "—"} />
              <Row k="per year" v={perYear !== null && renewable ? `${fmtToken(perYear, token.decimals)} ${token.symbol}` : "—"} />
              <Row k="seconds" v={renewable && seconds > 0n ? seconds.toLocaleString("en-US") : "—"} dim />
              {mode === "budget" && budgetAmount !== null && amount !== undefined && renewable && budgetAmount - amount >= 10n ** BigInt(token.decimals) / 100n ? <Row k="left over" v={`${fmtToken(budgetAmount - amount, token.decimals)} ${token.symbol}`} dim /> : null}
            </dl>

            <div className="mt-auto pt-5">
              {!isConnected ? (
                <ConnectButton />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="accent" disabled={!canPay} onClick={extend}>
                    {payLabel}
                  </Button>
                  <span className="t-caption normal-case tracking-normal">
                    {!renewable ? "pick a name that can be extended." : quote.isError ? <StatusText tone="err">{(quote.error as Error).message}</StatusText> : amount !== undefined && !enough ? `not enough ${token.symbol} in ${shortAddr(address!, 4)}.` : busy ? "two transactions: approve, then extend." : approved ? "one transaction." : "two transactions: approve, then extend."}
                  </span>
                </div>
              )}
              {done ? (
                <p className="t-caption mt-3 normal-case tracking-normal">
                  <StatusText tone="ok">{done.name} extended by {fmtDuration(done.seconds)}</StatusText> ·{" "}
                  <a className="link-blue" href={`https://etherscan.io/tx/${done.hash}`} target="_blank" rel="noreferrer">
                    {shortAddr(done.hash, 8)}
                  </a>{" "}
                  · <Link className="link-blue" to={`/${done.name}`}>open the record</Link>
                </p>
              ) : null}
            </div>
          </div>
        </FigSplit>
      </Figure>

      {/* ------------------------------------------------------------ details */}
      <div className="mt-8 border-t border-line">
        <FaqRow q="how do the discounts work?">
          The whole term is priced at the rate of the highest tier it reaches. {pricing.data ? tiers(pricing.data).filter((t) => t.start > 0n).sort((a, b) => (a.start < b.start ? -1 : 1)).map((t) => `${t.years}+ years ${t.off}% off`).join(", ") : "…"}. Just under a threshold costs more than just over it, which is why the budget view suggests the next tier.
        </FaqRow>
        <FaqRow q="who can extend a name?">Anyone. Extending changes the expiry and nothing else.</FaqRow>
        <FaqRow q="what if the name has expired?">It can still be extended during the grace period: 28 days on ENSv2, 90 days for names still on ENSv1. After that it is released.</FaqRow>
        <FaqRow q="which contract is paid?">
          The ENS registrar, read live from mainnet. Names on ENSv2 go through{" "}
          <a className="link-blue" href="https://etherscan.io/address/0xd6d8369e55c94ae8afa714e6cf7ab5be54d5cc81" target="_blank" rel="noreferrer">ETHRegistrar</a>, names still on ENSv1 through{" "}
          <a className="link-blue" href="https://etherscan.io/address/0x56c447f308f463a01121c41e72b0e7e7557fcb68" target="_blank" rel="noreferrer">ETHRenewerV1</a>, which also moves the v1 expiry.
        </FaqRow>
      </div>
    </Section>
  )
}

function Row({ k, v, dim }: { k: string; v: ReactNode; dim?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-ink-dim">{k}</dt>
      <dd className={`tabular text-right ${dim ? "text-ink-dim" : "text-ink"}`}>{v}</dd>
    </div>
  )
}

function NameStatus({ typed, name, info }: { typed: string; name: string | null; info: ReturnType<typeof useRenewInfo> }) {
  if (!typed.trim()) return <>type a .eth name, or pick one of yours.</>
  if (!name) return <>include the ending, like alice.eth.</>
  if (!isEthSecondLevel(name)) return <>only .eth names can be extended. subnames follow their parent.</>
  if (info.isLoading) return <>reading {name}…</>
  if (info.isError || !info.data) return <StatusText tone="err">could not read {name}.</StatusText>
  const d = info.data
  const v2 = d.v2 ? <V2 /> : null
  if (d.status === "registered") {
    const days = daysUntil(d.expiry!)
    return (
      <>
        expires {fmtDate(d.expiry!)} · <span className={days < 30 ? "text-wait" : undefined}>{days} days</span> {v2}
      </>
    )
  }
  if (d.status === "grace")
    return (
      <>
        <StatusText tone="err">expired {fmtDate(d.expiry!)} · renew by {fmtDate(d.graceEnds!)}</StatusText> {v2}
      </>
    )
  if (d.status === "expired") return <StatusText tone="err">expired {fmtDate(d.expiry!)} · past its grace period.</StatusText>
  return <>{name} is not registered.</>
}

const MONTH_SECONDS = 2_629_800

/** "13 more months", or days when it is under a month */
function fmtGain(seconds: bigint): string {
  const months = Math.round(Number(seconds) / MONTH_SECONDS)
  if (months >= 1) return `${months} more ${months === 1 ? "month" : "months"}`
  const days = Math.max(1, Math.round(Number(seconds) / 86_400))
  return `${days} more ${days === 1 ? "day" : "days"}`
}

type Offer = { years: number; off: number; cost: bigint; extraAmount: bigint; extraDuration: bigint }

type BudgetPickerProps = {
  usdText: string
  setUsd: (v: string) => void
  budgetAmount: bigint | null
  decimals: number
  pricing: Pricing | undefined
  label: string | undefined
  ready: boolean
  offer: Offer | null
  activeYears: number
}

/**
 * The budget comes first: a big amount you tap to type, a slider to feel the range, a tip when
 * a little more reaches the next tier, and the tiers themselves as cards that set the budget
 * to their entry price.
 */
function BudgetPicker({ usdText, setUsd, budgetAmount, decimals, pricing, label, ready, offer, activeYears }: BudgetPickerProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const dollars = (amount: bigint) => fmtToken(amount, decimals)
  const tierList = useMemo(() => (pricing ? tiers(pricing).filter((t) => t.start > 0n).sort((a, b) => (a.start < b.start ? -1 : 1)) : []), [pricing])
  const costs = useMemo(() => (pricing ? tierList.map((t) => ceilToCent(priceFor(pricing, label ?? "alice", t.start), decimals)) : []), [pricing, tierList, label, decimals])
  // the slider runs to 1.6× the best tier's entry price, so the sweet spot sits at the top of the comfortable range
  const max = costs.length ? (costs[costs.length - 1] * 8n) / 5n : 0n
  const value = max > 0n && budgetAmount !== null ? Math.min(1, Number(budgetAmount) / Number(max)) : 0

  function commit() {
    const a = parseDollars(draft, decimals)
    if (a !== null) setUsd(dollars(a))
    setEditing(false)
  }

  return (
    <div className="mt-5">
      <Label>your budget</Label>
      <div className="mt-2 flex flex-wrap items-start gap-x-6 gap-y-3">
        <div>
          {editing ? (
            <div className="flex items-baseline gap-1">
              <span className="t-h2 text-ink-dim">$</span>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit()
                  if (e.key === "Escape") setEditing(false)
                }}
                inputMode="decimal"
                aria-label="budget in dollars"
                className="t-h2 tabular w-[8ch] min-w-0 border-b border-blue bg-transparent text-ink outline-none"
              />
            </div>
          ) : (
            <button type="button" onClick={() => { setDraft(usdText); setEditing(true) }} className="t-h2 tabular block border-b border-transparent text-ink transition-colors hover:border-line" title="tap to type an amount">
              {budgetAmount !== null ? fmtDollars(budgetAmount, decimals) : "$—"}
            </button>
          )}
          <div className="t-caption mt-1.5 normal-case tracking-normal">tap the amount to type your own</div>
        </div>
        {offer && ready ? (
          <button type="button" onClick={() => setUsd(dollars(offer.cost))} className="group self-center border-l border-line pl-4 text-left">
            <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-blue">
              <span>add {fmtDollars(offer.cost - (budgetAmount ?? 0n), decimals)}</span>
              <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="font-medium text-ink group-hover:text-blue">get {fmtGain(offer.extraDuration)}</span>
            </span>
            <span className="t-caption mt-0.5 block normal-case tracking-normal">{offer.years}-year rate · {offer.off}% off</span>
          </button>
        ) : null}
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.0005}
        value={value}
        disabled={!ready || max === 0n}
        onChange={(e) => setUsd(dollars(ceilToCent((max * BigInt(Math.round(Number(e.target.value) * 10_000))) / 10_000n, decimals)))}
        aria-label="budget"
        aria-valuetext={`$${usdText}`}
        className="budget-slider mt-4"
        style={{ "--fill": `${value * 100}%` } as CSSProperties}
      />
      <TierCards items={tierList.map((t, i) => ({ years: t.years, off: t.off, sub: ready ? fmtDollars(costs[i], decimals) : undefined }))} activeYears={ready ? activeYears : -1} onPick={(y) => { const i = tierList.findIndex((t) => t.years === y); if (i >= 0) setUsd(dollars(costs[i])) }} />
      <p className="t-caption mt-4 flex items-center gap-2 normal-case tracking-normal">
        <BadgePercent className="size-3.5 shrink-0" aria-hidden="true" />
        <span>
          discounts follow{" "}
          <a className="link-blue text-ink" href="https://docs.ens.domains/ensv2/eth-registrar/#multi-year-discounts" target="_blank" rel="noreferrer">
            ENS's pricing tiers
          </a>
          . a little more can reach the next one.
        </span>
      </p>
    </div>
  )
}

/** the discount tiers as cards: badge in the corner, the active one filled */
function TierCards({ items, activeYears, onPick }: { items: { years: number; off: number; sub?: string }[]; activeYears: number; onPick: (years: number) => void }) {
  if (items.length === 0) return null
  return (
    <div className="mt-6 grid gap-2.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((t) => {
        const active = t.years === activeYears
        return (
          <button key={t.years} type="button" aria-pressed={active} onClick={() => onPick(t.years)} className={`relative border px-1.5 py-4 text-center transition-colors ${active ? "border-blue bg-wash" : "border-line hover:border-blue"}`}>
            {t.off ? <span className={`tabular absolute -top-2 right-1.5 border px-1.5 py-0.5 text-[10px] leading-none ${active ? "border-blue bg-blue text-blue-fg" : "border-line bg-paper text-ink-muted"}`}>−{t.off}%</span> : null}
            <div className={`text-[13px] ${active ? "font-semibold text-ink" : "text-ink-muted"}`}>
              {t.years} {t.years === 1 ? "year" : "years"}
            </div>
            {t.sub ? <div className="t-caption mt-1 normal-case tracking-normal">{t.sub}</div> : null}
          </button>
        )
      })}
    </div>
  )
}

const PICK_PAGE = 8

/** the connected wallet's .eth names in a dropdown: a filter, eight per page, soonest to expire first */
function YourNamesPicker({ current, onPick }: { current: string | null; onPick: (name: string) => void }) {
  const { address } = useConnection()
  const mine = useMyNames(address)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const all = useMemo(() => (mine.data?.names ?? []).filter((n) => isEthSecondLevel(n.name) && n.expiresAt).sort((a, b) => a.expiresAt! - b.expiresAt!), [mine.data])
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? all.filter((n) => n.name.includes(needle)) : all
  }, [all, q])
  const pager = usePager(shown, PICK_PAGE)
  if (!address || all.length === 0) return null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" />}>your names ▾</PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] p-0 font-mono">
        {all.length > PICK_PAGE ? (
          <div className="border-b border-line p-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`filter ${all.length} names`} aria-label="filter your names" className="h-8" autoFocus />
          </div>
        ) : null}
        {shown.length === 0 ? (
          <p className="p-3 text-[12px] text-ink-dim">nothing matches.</p>
        ) : (
          <ul className="divide-y divide-line">
            {pager.slice.map((n) => {
              const days = daysUntil(n.expiresAt!)
              return (
                <li key={n.name}>
                  <button type="button" onClick={() => { onPick(n.name); setOpen(false) }} className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-[12.5px] hover:bg-wash ${n.name === current ? "text-blue" : "text-ink"}`}>
                    <span className="truncate font-semibold">{n.name}</span>
                    <span className={`shrink-0 text-[11px] ${days < 0 ? "text-err" : days < 30 ? "text-wait" : "text-ink-dim"}`}>{days < 0 ? "expired" : `${days} days`}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <Pager page={pager.page} pages={pager.pages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
      </PopoverContent>
    </Popover>
  )
}
