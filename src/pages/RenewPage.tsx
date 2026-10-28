import { type ReactNode, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { type Hex, erc20Abi } from "viem"
import { normalize } from "viem/ens"
import { useConnection, useReadContract, useSwitchChain, useWriteContract } from "wagmi"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConnectButton } from "@/components/wallet/ConnectButton"
import { FaqRow, FigSplit, Figure, Section, SectionHeader, StatusText, V2 } from "@/components/wrap"
import { useMyNames } from "@/hooks/useMyNames"
import { renewInfoKey, useRenewInfo, useRenewQuote, useRentPricing } from "@/hooks/useRenew"
import { publicClient } from "@/lib/ens/clients"
import { PAY_TOKENS, type PayToken, YEAR, ceilToCents, durationForBudget, fmtDuration, fmtToken, fmtUsd, isEthSecondLevel, nextTierOffer, parseUsd, priceUnits, renewerAbi, tierFor, tiers, toAmount, yearsToSeconds } from "@/lib/ens/renew"
import { daysUntil, fmtDate, shortAddr } from "@/lib/format"
import { asChainId } from "@/lib/wagmi"

const MAINNET = 1
const QUICK_YEARS = [1, 2, 3, 6]
const ZERO_REF = `0x${"0".repeat(64)}` as Hex

type Mode = "budget" | "years"

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

  const pricing = useRentPricing()
  const info = useRenewInfo(name)
  const label = info.data?.label
  const renewable = !!info.data?.renewer && (info.data.status === "registered" || info.data.status === "grace")
  const [mode, setMode] = useState<Mode>("budget")
  const [token, setToken] = useState<PayToken>(PAY_TOKENS[0])
  const ratio = pricing.data?.ratios[token.address.toLowerCase()]
  const [years, setYears] = useState("1")
  const [usd, setUsd] = useState<string | null>(null)

  // the budget starts at the six-year entry price for this name, the point where a dollar buys the most time
  const defaultUsd = useMemo(() => {
    if (!pricing.data) return ""
    const best = tiers(pricing.data)[0]
    const units = priceUnits(pricing.data, label && renewable ? label : "alice", best.start)
    return units > 0n ? fmtUsd(ceilToCents(units)).slice(1) : ""
  }, [pricing.data, label, renewable])
  const usdText = usd ?? defaultUsd
  const budgetUnits = parseUsd(usdText)

  const wantedSeconds = useMemo(() => {
    if (mode === "years") {
      const y = Number(years)
      return Number.isFinite(y) && y > 0 ? yearsToSeconds(Math.min(y, 100)) : 0n
    }
    if (!pricing.data || !label || budgetUnits === null) return 0n
    return durationForBudget(pricing.data, label, budgetUnits)?.seconds ?? 0n
  }, [mode, years, pricing.data, label, budgetUnits])
  const budgetAmount = mode === "budget" && budgetUnits !== null && ratio ? toAmount(budgetUnits, ratio) : undefined
  const quote = useRenewQuote(renewable ? info.data!.renewer : null, label, wantedSeconds, token.address, budgetAmount)
  const seconds = quote.data?.seconds ?? wantedSeconds
  const amount = quote.data?.amount
  const tier = pricing.data && seconds > 0n ? tierFor(pricing.data, seconds) : null
  const offer = mode === "budget" && pricing.data && label && renewable && budgetUnits !== null ? nextTierOffer(pricing.data, label, budgetUnits) : null
  const perYear = amount && seconds > 0n ? (amount * YEAR) / seconds : null

  // wallet side: balance and allowance for the chosen token
  const balance = useReadContract({ address: token.address, abi: erc20Abi, functionName: "balanceOf", args: address ? [address] : undefined, chainId: MAINNET, query: { enabled: !!address } })
  const allowance = useReadContract({ address: token.address, abi: erc20Abi, functionName: "allowance", args: address && info.data?.renewer ? [address, info.data.renewer] : undefined, chainId: MAINNET, query: { enabled: !!address && !!info.data?.renewer } })
  const enough = amount !== undefined && balance.data !== undefined && balance.data >= amount
  const approved = amount !== undefined && allowance.data !== undefined && allowance.data >= amount

  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const qc = useQueryClient()
  const [phase, setPhase] = useState<"idle" | "approving" | "extending">("idle")
  const [done, setDone] = useState<{ hash: Hex; seconds: bigint; name: string } | null>(null)

  async function extend() {
    if (!address || !info.data?.renewer || !label || !amount || seconds <= 0n) return
    const renewer = info.data.renewer
    try {
      if (walletChainId !== MAINNET) await switchChainAsync({ chainId: asChainId(MAINNET) })
      if (!approved) {
        setPhase("approving")
        const hash = await writeContractAsync({ address: token.address, abi: erc20Abi, functionName: "approve", args: [renewer, amount], chainId: asChainId(MAINNET) })
        toast("approval sent", { description: shortAddr(hash, 8) })
        await publicClient(MAINNET).waitForTransactionReceipt({ hash })
        allowance.refetch()
      }
      setPhase("extending")
      const hash = await writeContractAsync({ address: renewer, abi: renewerAbi, functionName: "renew", args: [{ label, duration: seconds, referrer: ZERO_REF }, token.address], chainId: asChainId(MAINNET) })
      toast("transaction sent", { description: shortAddr(hash, 8) })
      await publicClient(MAINNET).waitForTransactionReceipt({ hash })
      setDone({ hash, seconds, name: name! })
      toast.success(`${name} extended`, { description: fmtDuration(seconds) })
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
          <Input id="renew-name" className="mt-2 sm:max-w-md" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="alice.eth" autoFocus={!given} />
          <YourNames typed={typed} onPick={(n) => setTyped(n)} />
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
                <TabsTrigger value="years">by years</TabsTrigger>
              </TabsList>
            </Tabs>

            {mode === "budget" ? (
              <div className="mt-5">
                <Label htmlFor="renew-usd">budget</Label>
                <div className="mt-2 flex items-center gap-2">
                  <span className="t-h3 text-ink-dim">$</span>
                  <Input id="renew-usd" inputMode="decimal" className="t-h3 h-12 sm:max-w-[12rem]" value={usdText} onChange={(e) => setUsd(e.target.value)} aria-invalid={usdText !== "" && budgetUnits === null} />
                </div>
                {pricing.data && label && renewable ? (
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    {[{ years: 1, start: YEAR, off: 0 }, ...tiers(pricing.data).filter((t) => t.start > 0n).sort((a, b) => (a.start < b.start ? -1 : 1))].map((t) => {
                      const units = ceilToCents(priceUnits(pricing.data!, label, t.start))
                      const text = fmtUsd(units).slice(1)
                      return (
                        <button key={t.years} type="button" onClick={() => setUsd(text)} className={`border px-2 py-0.5 ${usdText === text ? "border-blue text-blue" : "border-line text-ink-muted hover:border-blue hover:text-blue"}`}>
                          {t.years} {t.years === 1 ? "year" : "years"} · ${text}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
                {offer ? (
                  <button type="button" onClick={() => setUsd(fmtUsd(offer.costUnits).slice(1))} className="link-blue mt-3 block text-left text-[12px] text-ink">
                    add {fmtUsd(offer.extraUnits)} for {offer.tier.years} years · {fmtDuration(offer.gainSeconds)} more at {offer.tier.off}% off
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="mt-5">
                <Label htmlFor="renew-years">years</Label>
                <Input id="renew-years" inputMode="decimal" className="t-h3 mt-2 h-12 sm:max-w-[12rem]" value={years} onChange={(e) => setYears(e.target.value)} aria-invalid={wantedSeconds === 0n} />
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                  {QUICK_YEARS.map((y) => {
                    const off = pricing.data ? tierFor(pricing.data, yearsToSeconds(y)).off : 0
                    return (
                      <button key={y} type="button" onClick={() => setYears(String(y))} className={`border px-2 py-0.5 ${years === String(y) ? "border-blue text-blue" : "border-line text-ink-muted hover:border-blue hover:text-blue"}`}>
                        {y} {y === 1 ? "year" : "years"}
                        {off ? ` · −${off}%` : ""}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

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
              {mode === "budget" && budgetUnits !== null && amount !== undefined && ratio && renewable && toAmount(budgetUnits, ratio) - amount >= 10n ** BigInt(token.decimals) / 100n ? <Row k="left over" v={`${fmtToken(toAmount(budgetUnits, ratio) - amount, token.decimals)} ${token.symbol}`} dim /> : null}
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
                    {!renewable ? "pick a name that can be extended." : amount !== undefined && !enough ? `not enough ${token.symbol} in ${shortAddr(address!, 4)}.` : busy ? "two transactions: approve, then extend." : approved ? "one transaction." : "two transactions: approve, then extend."}
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
        <StatusText tone="wait">expired {fmtDate(d.expiry!)}</StatusText> · {daysUntil(d.graceEnds!)} days left to extend {v2}
      </>
    )
  if (d.status === "expired") return <StatusText tone="err">expired {fmtDate(d.expiry!)} · past its grace period.</StatusText>
  return <>{name} is not registered.</>
}

/** the connected wallet's .eth names, soonest to expire first, narrowed by what is typed */
function YourNames({ typed, onPick }: { typed: string; onPick: (name: string) => void }) {
  const { address } = useConnection()
  const mine = useMyNames(address)
  const names = useMemo(() => {
    const all = (mine.data?.names ?? []).filter((n) => isEthSecondLevel(n.name) && n.expiresAt)
    const q = typed.trim().toLowerCase()
    const hit = q && !q.includes(".") ? all.filter((n) => n.name.startsWith(q)) : all
    return hit.sort((a, b) => a.expiresAt! - b.expiresAt!).slice(0, 8)
  }, [mine.data, typed])
  if (!address || names.length === 0) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-ink-dim">yours, soonest first:</span>
      {names.map((n) => (
        <button key={n.name} type="button" onClick={() => onPick(n.name)} className={`border px-2 py-0.5 ${typed.trim().toLowerCase() === n.name ? "border-blue text-blue" : "border-line text-ink-muted hover:border-blue hover:text-blue"}`}>
          {n.name}
          {n.expiresAt && daysUntil(n.expiresAt) < 60 ? <Badge variant="dim" className="ml-1.5 px-1 py-0 text-[9px]">{daysUntil(n.expiresAt)}d</Badge> : null}
        </button>
      ))}
    </div>
  )
}

