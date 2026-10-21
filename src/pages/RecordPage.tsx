import { useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useConnection, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi"
import type { Address, Hex } from "viem"
import { normalize } from "viem/ens"
import { Button } from "@/components/ui/button"
import { Figure, Section, SectionHeader, StatRow, StatusText, LivePill, Code, k, s, c, p } from "@/components/wrap"
import { AccountsTable, type Row } from "@/components/record/AccountsTable"
import { AddAccountDialog } from "@/components/record/AddAccountDialog"
import { NetworkSelect } from "@/components/record/NetworkSelect"
import { useRecord, recordQueryKey } from "@/hooks/useRecord"
import { useNameOwner } from "@/hooks/useNameOwner"
import { usePublishAuthority } from "@/hooks/usePublishAuthority"
import { useDrafts } from "@/hooks/useDrafts"
import { chainById, DEFAULT_RECORDS_CHAIN, RECORDS_CHAINS } from "@/lib/ens/chains"
import { dataResolverAbi } from "@/lib/ens/abis"
import { buildPublishCalls, type PublishPlan } from "@/lib/ens/write"
import { isOwned } from "@/lib/ensip28"
import { asChainId } from "@/lib/wagmi"
import { daysUntil, fmtDate, sameAddr, shortAddr } from "@/lib/format"

function useRecordsChain() {
  const [params, setParams] = useSearchParams()
  const slug = params.get("net")
  const meta = RECORDS_CHAINS.find((c) => c.slug === slug) ?? DEFAULT_RECORDS_CHAIN
  const set = (chainId: number) => {
    const next = new URLSearchParams(params)
    const m = chainById(chainId)
    if (!m || m.chain.id === DEFAULT_RECORDS_CHAIN.chain.id) next.delete("net")
    else next.set("net", m.slug)
    setParams(next, { replace: true })
  }
  return { recordsChainId: meta.chain.id, recordsChain: meta, set }
}

export default function RecordPage() {
  const { name: rawName = "" } = useParams()
  const { recordsChainId, recordsChain, set: setRecordsChain } = useRecordsChain()

  let name: string | null = null
  try {
    name = normalize(rawName)
  } catch {
    name = null
  }

  const record = useRecord(name ?? undefined, recordsChainId)
  const owner = useNameOwner(name ?? undefined, recordsChainId)
  const drafts = useDrafts(name ?? undefined, recordsChainId)
  const { address, chainId: walletChainId, isConnected } = useConnection()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync, isPending: sending } = useWriteContract()
  const [txHash, setTxHash] = useState<Hex | undefined>()
  const receipt = useWaitForTransactionReceipt({ hash: txHash, chainId: asChainId(recordsChainId) })
  const qc = useQueryClient()
  const [dialog, setDialog] = useState<{ open: boolean; chainId?: number }>({ open: false })

  const data = record.data
  const authority = usePublishAuthority(name ?? undefined, recordsChainId, data?.resolver, data?.capabilities, address, owner.data?.owner)
  const canPublish = authority.data?.canPublish ?? false

  // merge on-chain rows with local drafts and removals
  const rows: Row[] = useMemo(() => {
    if (!data) return []
    const out: Row[] = []
    for (const ch of data.chains) {
      for (const a of ch.accounts) {
        const removing = drafts.removals.some((r) => r.chainId === a.chainId && sameAddr(r.account, a.account))
        const draft = drafts.adds.find((d) => d.chainId === a.chainId && sameAddr(d.account, a.account))
        out.push({
          chainId: a.chainId,
          account: a.account,
          kind: draft?.kind ?? a.kind,
          status: removing ? "removing" : draft ? "draft" : a.check.status,
          reason: removing ? "will be removed on publish" : draft ? "new consent signed · publish to write" : a.check.reason,
          expiresAt: draft ? BigInt(draft.expiresAt) : a.check.expiresAt,
          pending: removing ? "remove" : draft ? "add" : undefined,
        })
      }
    }
    for (const d of drafts.adds) {
      if (out.some((r) => r.chainId === d.chainId && sameAddr(r.account, d.account))) continue
      out.push({ chainId: d.chainId, account: d.account, kind: d.kind, status: "draft", reason: "consent signed · publish to write", expiresAt: BigInt(d.expiresAt), pending: "add" })
    }
    return out.sort((x, y) => x.chainId - y.chainId || x.account.localeCompare(y.account))
  }, [data, drafts.adds, drafts.removals])

  const onChain = data?.chains.flatMap((c) => c.accounts) ?? []
  const verified = onChain.filter((a) => isOwned(a.check.status))
  const nextExpiry = verified.map((a) => a.check.expiresAt!).sort((a, b) => (a < b ? -1 : 1))[0]
  const chainCount = new Set(onChain.map((a) => a.chainId)).size

  async function publish() {
    if (!data || !data.resolver || !name) return
    const plan: PublishPlan = { listings: {}, proofs: [], removals: drafts.removals }
    const chainIds = new Set<number>([...data.chains.map((c) => c.chainId), ...drafts.adds.map((d) => d.chainId)])
    for (const chainId of chainIds) {
      const existing = data.chains.find((c) => c.chainId === chainId)?.accounts.map((a) => a.account) ?? []
      const kept = existing.filter((a) => !drafts.removals.some((r) => r.chainId === chainId && sameAddr(r.account, a)))
      const added = drafts.adds.filter((d) => d.chainId === chainId).map((d) => d.account)
      const merged: Address[] = [...kept]
      for (const a of added) if (!merged.some((m) => sameAddr(m, a))) merged.push(a)
      plan.listings[chainId] = merged
    }
    plan.proofs = drafts.adds.map((d) => ({ chainId: d.chainId, account: d.account, expiresAt: BigInt(d.expiresAt), signature: d.signature }))
    const calls = buildPublishCalls(name, plan, data.capabilities?.writeFlavour ?? "node")
    try {
      if (walletChainId !== recordsChainId) await switchChainAsync({ chainId: asChainId(recordsChainId) })
      const hash = await writeContractAsync({ address: data.resolver, abi: dataResolverAbi, functionName: "multicall", args: [calls], chainId: asChainId(recordsChainId) })
      setTxHash(hash)
      toast("transaction sent", { description: shortAddr(hash, 8) })
    } catch (e) {
      toast.error("publish failed", { description: (e as Error).message?.split("\n")[0] })
    }
  }

  // once mined: clear drafts and refetch
  if (receipt.isSuccess && txHash && drafts.pending > 0) {
    drafts.clear()
    qc.invalidateQueries({ queryKey: recordQueryKey(name ?? "", recordsChainId) })
    toast.success("record published", { description: `${shortAddr(txHash, 8)} · mined` })
  }

  if (!name) {
    return (
      <Section>
        <SectionHeader eyebrow="record" title="That is not a valid ENS name" lede={`"${rawName}" does not normalise under ENSIP-15.`} />
        <Button variant="outline" render={<Link to="/" />}>back</Button>
      </Section>
    )
  }

  const explorer = recordsChain.explorer
  const canEdit = isConnected
  const embed = `[![on the record](https://records.xyz/badge.svg)](https://records.xyz/${name})`

  return (
    <>
      <Section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeader
            as="h1"
            eyebrow="record"
            title={name}
            lede={
              record.isLoading ? "reading records…" : data?.resolver
                ? `${verified.length} verified ${verified.length === 1 ? "account" : "accounts"} across ${chainCount} ${chainCount === 1 ? "chain" : "chains"}, read live from ${recordsChain.label} and verified in your browser.`
                : `no resolver found for this name on ${recordsChain.label}.`
            }
            className="mb-0"
          />
          <div className="flex flex-col items-end gap-2 pt-2">
            <NetworkSelect value={recordsChainId} onChange={setRecordsChain} />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(window.location.href); toast("link copied") }}>copy link</Button>
              <Button variant="outline" size="sm" onClick={() => record.refetch()}>re-verify</Button>
            </div>
          </div>
        </div>

        <StatRow
          className="mt-8"
          stats={[
            { label: "on the record", value: record.isLoading ? "…" : String(onChain.length) },
            { label: "chains", value: record.isLoading ? "…" : String(chainCount) },
            { label: "verified", value: record.isLoading ? "…" : `${verified.length}/${onChain.length || 0}` },
            { label: "next expiry", value: nextExpiry ? `${daysUntil(nextExpiry)}d` : "—", hint: nextExpiry ? fmtDate(nextExpiry) : undefined },
          ]}
        />

        {data && data.resolver && !data.supportsData ? (
          <div className="mt-4 border border-line bg-paper px-4 py-3 text-[12px]">
            <StatusText tone="wait">this name's resolver cannot {data.capabilities?.readsData ? "write" : "store"} data records.</StatusText>{" "}
            <span className="text-ink-muted">
              owned accounts are ENSIP-24 data records. the resolver at{" "}
              <a className="link-blue" href={`${explorer}/address/${data.resolver}`} target="_blank" rel="noreferrer">{shortAddr(data.resolver)}</a>{" "}
              {data.capabilities?.readsData ? "answers data reads but exposes no setData, so nothing can be published through it." : "does not answer data(bytes32,string)."}{" "}
              ENSv2 resolvers support them: {recordsChainId === 11155111 ? (
                <>upgrade or re-register the name in the <a className="link-blue" href="https://sepolia.app.ens.domains/" target="_blank" rel="noreferrer">Sepolia ENS App</a>.</>
              ) : (
                <>upgrade the name to ENSv2 in the <a className="link-blue" href="https://app.ens.domains/" target="_blank" rel="noreferrer">ENS App</a> once ENSv2 is activated on mainnet.</>
              )}
            </span>
          </div>
        ) : null}
        {data?.capabilities && data.supportsData ? (
          <div className="mt-4 text-[11px] text-ink-dim">
            resolver <a className="link-blue" href={`${explorer}/address/${data.resolver}`} target="_blank" rel="noreferrer">{shortAddr(data.resolver!)}</a>
            {" · "}{data.capabilities.writeFlavour === "name" ? "ENSv2 permissioned resolver" : data.capabilities.canModifyName ? "ENSv2 public resolver" : "v1-style resolver"}
            {" · "}data records {data.capabilities.erc165Data ? "advertised via ERC-165" : "detected by probing"}
          </div>
        ) : null}
        {data?.chains.some((c) => c.malformed) ? (
          <div className="mt-4 text-[12px]"><StatusText tone="err">one or more listing records are malformed and were ignored.</StatusText></div>
        ) : null}
        {record.isError ? (
          <div className="mt-4 text-[12px]"><StatusText tone="err">could not read records: {(record.error as Error).message.split("\n")[0]}</StatusText></div>
        ) : null}

        <Figure n={1} name={`owned accounts · ${name}`} className="mt-8" padded={false} dotted={false}>
          {record.isLoading ? (
            <div className="t-body px-5 py-8 text-center">reading listings and verifying proofs…</div>
          ) : (
            <AccountsTable
              rows={rows}
              canEdit={canEdit}
              onRemove={(r) => drafts.markRemoval({ chainId: r.chainId, account: r.account })}
              onUndo={(r) => (r.pending === "add" ? drafts.dropDraft({ chainId: r.chainId, account: r.account }) : drafts.unmarkRemoval({ chainId: r.chainId, account: r.account }))}
              onRenew={(r) => setDialog({ open: true, chainId: r.chainId })}
            />
          )}
        </Figure>
        <p className="t-caption mt-3 normal-case tracking-normal">
          owned accounts are not payment addresses. do not send funds to them on the strength of this page. verification: ERC-1271 for contracts, ecrecover for EOAs, expiry ≤ 2 years.
        </p>
      </Section>

      <Section>
        <SectionHeader
          eyebrow="manage"
          title="Put an account on the record"
          lede="Each account signs its own consent. The name owner publishes every listing and proof in one transaction."
        />
        <Figure n={2} name="publish">
          <div className="flex flex-wrap items-center gap-3">
            {!isConnected ? (
              <span className="t-body">connect a wallet to sign consents or publish.</span>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDialog({ open: true })}>+ add connected account</Button>
                <span className="t-body">
                  {authority.isLoading ? (
                    <>checking whether {shortAddr(address!)} can write records…</>
                  ) : canPublish ? (
                    <><LivePill pulse={false}>{authority.data?.via === "owner" ? "owner" : "authorised"}</LivePill> {shortAddr(address!)} can publish{authority.data?.via === "roles" ? " (resolver role)" : authority.data?.via === "canModifyName" ? " (ENSv2 registry)" : ""}.</>
                  ) : owner.data?.owner ? (
                    <>{shortAddr(address!)} cannot write records for this name (owner {shortAddr(owner.data.owner)}{owner.data.source ? ` · ${owner.data.source}` : ""}). sign consents here, then connect the owner wallet to publish.</>
                  ) : data?.capabilities?.roles || data?.capabilities?.canModifyName ? (
                    <>{shortAddr(address!)} has no write role on this ENSv2 resolver. sign consents here, then connect a wallet that does.</>
                  ) : (
                    <>no owner found for this name on {recordsChain.label}.</>
                  )}
                </span>
              </>
            )}
          </div>

          {drafts.pending > 0 ? (
            <div className="mt-5 border border-line bg-paper">
              <div className="t-label border-b border-line px-4 py-2 text-ink-dim">pending · {drafts.pending}</div>
              <ul className="divide-y divide-line-soft px-4 text-[12px]">
                {drafts.adds.map((d) => (
                  <li key={`a:${d.chainId}:${d.account}`} className="flex flex-wrap items-center gap-3 py-2">
                    <StatusText tone="blue">add</StatusText>
                    <span className="tabular">{shortAddr(d.account, 6)}</span>
                    <span className="text-ink-dim">{chainById(d.chainId)?.label} · until {fmtDate(BigInt(d.expiresAt))}</span>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => drafts.dropDraft(d)}>discard</Button>
                  </li>
                ))}
                {drafts.removals.map((r) => (
                  <li key={`r:${r.chainId}:${r.account}`} className="flex flex-wrap items-center gap-3 py-2">
                    <StatusText tone="err">remove</StatusText>
                    <span className="tabular">{shortAddr(r.account, 6)}</span>
                    <span className="text-ink-dim">{chainById(r.chainId)?.label}</span>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => drafts.unmarkRemoval(r)}>undo</Button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
                <Button
                  variant="accent"
                  disabled={!canPublish || !data?.resolver || !data?.supportsData || sending || receipt.isLoading}
                  onClick={publish}
                >
                  {sending ? "confirm in wallet…" : receipt.isLoading ? "mining…" : `publish ${drafts.pending} ${drafts.pending === 1 ? "change" : "changes"}`}
                </Button>
                <span className="t-caption normal-case tracking-normal">
                  one <code>multicall</code> on the resolver, from the owner wallet on {recordsChain.label}.
                  {txHash ? <> tx <a className="link-blue" href={`${explorer}/tx/${txHash}`} target="_blank" rel="noreferrer">{shortAddr(txHash, 6)}</a></> : null}
                </span>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={drafts.clear}>clear all</Button>
              </div>
            </div>
          ) : null}
        </Figure>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Figure n={3} name="what gets written" padded={false}>
            <Code lines={[
              [c(`# resolver ${data?.resolver ? shortAddr(data.resolver) : "0x…"} · ${recordsChain.label}`)],
              [k("accounts-chains"), p(": "), s(`[${Array.from(new Set([...onChain.map((a) => a.chainId), ...drafts.adds.map((d) => d.chainId)])).join(", ") || "…"}]`)],
              ...rows.filter((r) => r.pending !== "remove").slice(0, 4).map((r) => [k(`accounts[${r.chainId}]`), p(" ∋ "), s(shortAddr(r.account, 6))]),
              ...rows.filter((r) => r.pending !== "remove").slice(0, 2).map((r) => [k(`accounts[${r.chainId}][${shortAddr(r.account, 3)}]`), p(": "), s(`(${r.expiresAt ?? "expiresAt"}, sig)`)]),
            ]} />
          </Figure>
          <Figure n={4} name="embed">
            <p className="t-body">link to this record from a bio or readme.</p>
            <pre className="code mt-3 border border-line bg-paper text-[11px] whitespace-pre-wrap break-all">{embed}</pre>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => { navigator.clipboard?.writeText(embed); toast("snippet copied") }}>copy markdown</Button>
          </Figure>
        </div>
      </Section>

      <AddAccountDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        name={name}
        node={data?.node ?? ("0x" as Hex)}
        recordsChainId={recordsChainId}
        initialChainId={dialog.chainId}
        onSigned={drafts.addDraft}
      />
    </>
  )
}
