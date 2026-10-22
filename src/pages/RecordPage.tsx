import { useMemo, useState } from "react"
import { Copy, RefreshCw } from "lucide-react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useConnection, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi"
import type { Address, Hex } from "viem"
import { normalize } from "viem/ens"
import { Button } from "@/components/ui/button"
import { Figure, Section, SectionHeader, StatRow, StatusText, LivePill, Code, FaqRow, k, s, c, p } from "@/components/wrap"
import { AccountsTableSkeleton } from "@/components/record/AccountsTable"
import { StatusMark, statusHelp } from "@/components/record/StatusMark"
import { ConnectButton } from "@/components/wallet/ConnectButton"
import { MyNameChips } from "@/components/wallet/MyNames"
import { AccountsTable, type Row } from "@/components/record/AccountsTable"
import { AddAccountDialog } from "@/components/record/AddAccountDialog"
import { NetworkSelect } from "@/components/record/NetworkSelect"
import { useRecord, recordQueryKey } from "@/hooks/useRecord"
import { useNameOwner } from "@/hooks/useNameOwner"
import { useProfile } from "@/hooks/useProfile"
import { ProfileCard } from "@/components/record/ProfileCard"
import { RecordEditor } from "@/components/record/RecordEditor"
import { AccessFigure } from "@/components/record/AccessFigure"
import { GrantDialog } from "@/components/record/GrantDialog"
import { SharedFigure, effectiveRecord } from "@/components/record/SharedFigure"
import { LinkDialog } from "@/components/record/LinkDialog"
import { useResolverLinks, linksQueryKey } from "@/hooks/useResolverLinks"
import { useResolverRoles } from "@/hooks/useResolverRoles"
import { adminBitsFor } from "@/lib/ens/roles"
import { hasBigName } from "@/lib/ens/bigname"
import { usePublishAuthority } from "@/hooks/usePublishAuthority"
import { useDrafts } from "@/hooks/useDrafts"
import { chainById, DEFAULT_RECORDS_CHAIN, RECORDS_CHAINS } from "@/lib/ens/chains"
import { dataResolverAbi } from "@/lib/ens/abis"
import { buildPublishCalls, type PublishPlan } from "@/lib/ens/write"
import { isOwned } from "@/lib/ensip28"
import { addressLabel } from "@/lib/ens/profile"
import { chainIdForCoinType, decodeValue, defFromId } from "@/lib/records"
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
  const profile = useProfile(name ?? undefined, recordsChainId, Object.keys(drafts.records))
  const { address, chainId: walletChainId, isConnected } = useConnection()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync, isPending: sending } = useWriteContract()
  const [txHash, setTxHash] = useState<Hex | undefined>()
  const receipt = useWaitForTransactionReceipt({ hash: txHash, chainId: asChainId(recordsChainId) })
  const qc = useQueryClient()
  const [dialog, setDialog] = useState<{ open: boolean; chainId?: number }>({ open: false })
  const [editingProfile, setEditingProfile] = useState(false)
  const [grantOpen, setGrantOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)

  const data = record.data
  // which record kinds the staged edits touch, so the permission check asks for exactly those
  const stagedKinds = useMemo(() => new Set(Object.keys(drafts.records).map((id) => defFromId(id)?.kind)), [drafts.records])
  const stagedTextKeys = useMemo(() => Object.keys(drafts.records).filter((id) => id.startsWith("text:")).map((id) => id.slice(5)), [drafts.records])
  const adminBits = drafts.access.reduce((acc, c) => acc | adminBitsFor(c), 0n)
  const needs = drafts.pending === 0
    ? { data: true }
    : {
        data: drafts.accountCount > 0 || stagedKinds.has("data"),
        text: stagedKinds.has("text"),
        addr: stagedKinds.has("address"),
        contenthash: stagedKinds.has("contenthash"),
        abi: stagedKinds.has("abi"),
        interface: stagedKinds.has("interface"),
        link: drafts.linkCount > 0,
        adminBits: adminBits ? adminBits.toString() : undefined,
      }
  const authority = usePublishAuthority(name ?? undefined, recordsChainId, data?.resolver, data?.capabilities, address, owner.data?.owner, owner.data?.manager, needs)
  const canPublish = authority.data?.canPublish ?? false
  const profileWritable = !!data?.capabilities?.profileWrite
  const hasLinks = !!data?.capabilities?.links
  const canWriteAll = (drafts.accountCount === 0 || !!data?.supportsData) && (drafts.profileCount === 0 || profileWritable) && (drafts.accessCount === 0 || !!data?.capabilities?.roles) && (drafts.linkCount === 0 || hasLinks)
  const hasRoles = !!data?.capabilities?.roles
  const links = useResolverLinks(name ?? undefined, recordsChainId, data?.resolver, hasLinks)
  const linkAuthority = usePublishAuthority(name ?? undefined, recordsChainId, data?.resolver, data?.capabilities, address, owner.data?.owner, owner.data?.manager, { link: true })
  const canLink = hasLinks && !!linkAuthority.data?.canPublish
  const defaultRecordId = links.data?.rows.find((r) => r.isDefault)?.recordId ?? "0"
  const myRecordId = effectiveRecord(links.data?.rows.find((r) => !r.isDefault && r.name === name), defaultRecordId)
  const resolverRoles = useResolverRoles(recordsChainId, data?.resolver, hasRoles)
  // can the connected wallet administer the three record kinds the grant dialog offers?
  const grantAdminNeeds = { adminBits: (adminBitsFor({ account: "0x0000000000000000000000000000000000000000", resource: "0", roleBitmap: ((1n << 0n) | (1n << 4n) | (1n << 24n)).toString(), revoke: false, scope: "" })).toString() }
  const adminAuthority = usePublishAuthority(name ?? undefined, recordsChainId, data?.resolver, data?.capabilities, address, owner.data?.owner, owner.data?.manager, grantAdminNeeds)
  const canAdmin = hasRoles && !!adminAuthority.data?.canPublish

  // merge onchain rows with local drafts and removals
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
  // payment address ↔ owned account match, bound to the chain the consent names
  const consentedKeys = useMemo(() => new Set(verified.map((a) => `${a.chainId}:${a.account.toLowerCase()}`)), [verified])
  const consented = (coinType: number, addr: string) => {
    const chainId = coinType === 60 ? (recordsChainId === 11155111 ? 11155111 : 1) : chainIdForCoinType(coinType)
    return chainId !== null && consentedKeys.has(`${chainId}:${addr.toLowerCase()}`)
  }
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
    if (drafts.accountCount === 0) plan.listings = {}
    plan.records = drafts.records
    plan.access = drafts.access
    plan.links = drafts.links
    const calls = buildPublishCalls(name, plan, { data: data.capabilities?.writeFlavour ?? "node", profile: data.capabilities?.profileWrite ?? "node" })
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
    qc.invalidateQueries({ queryKey: ["profile", recordsChainId, name] })
    qc.invalidateQueries({ queryKey: ["resolver-roles", recordsChainId] })
    qc.invalidateQueries({ queryKey: linksQueryKey(recordsChainId, data?.resolver) })
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
  const loading = record.isLoading
  const total = onChain.length
  const summaryStatus = loading ? null : total === 0 ? null : verified.length === total ? "verified" : verified.length > 0 ? "expiring" : "expired"
  const checkedAt = data ? new Date(data.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null
  const pendingCount = drafts.pending

  return (
    <>
      {/* ---------------------------------------------------------------- header */}
      <Section>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="t-eyebrow"># record · {recordsChain.label}</div>
            <h1 className="t-display mt-2 break-all text-ink">{name}</h1>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {loading ? (
                <div className="h-12 w-56 bg-wash" />
              ) : summaryStatus ? (
                <StatusMark
                  size="lg"
                  status={summaryStatus}
                  detail={
                    verified.length === total
                      ? `${total} ${total === 1 ? "account" : "accounts"} across ${chainCount} ${chainCount === 1 ? "chain" : "chains"} · every consent checks out`
                      : `${verified.length} of ${total} accounts verified · ${total - verified.length} ${total - verified.length === 1 ? "needs" : "need"} attention`
                  }
                />
              ) : record.isError ? (
                <StatusMark size="lg" status="unverified" detail={`could not reach ${recordsChain.label} just now · try re-check`} />
              ) : data?.resolver ? (
                <StatusMark size="lg" status="unverified" detail="no accounts on the record yet" />
              ) : (
                <StatusMark size="lg" status="invalid" detail={`no resolver for this name on ${recordsChain.label}`} />
              )}
              {checkedAt ? (
                <button type="button" onClick={() => record.refetch()} className="link-blue inline-flex items-center gap-1.5 text-[11px] text-ink-dim">
                  <RefreshCw className={`size-3 ${record.isFetching ? "animate-spin" : ""}`} />
                  checked live at {checkedAt} · re-check
                </button>
              ) : null}
            </div>
            <p className="t-lede mt-4 max-w-[60ch]">
              The profile and payment addresses {name} publishes, and below them the accounts it has publicly claimed as its own. Each claimed account signed its own consent, and this page verifies every signature in your browser, straight from chain.
            </p>
            <MyNameChips exclude={{ name, chainId: recordsChainId }} />
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <NetworkSelect value={recordsChainId} onChange={setRecordsChain} />
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(window.location.href); toast("link copied") }}>
              <Copy data-icon="inline-start" /> copy link
            </Button>
          </div>
        </div>

        {data && data.resolver && !data.supportsData ? (
          <div className="mt-6 border border-line bg-paper px-4 py-3 text-[12px]">
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
        {data?.chains.some((c) => c.malformed) ? (
          <div className="mt-4 text-[12px]"><StatusText tone="err">one or more listing records are malformed and were ignored.</StatusText></div>
        ) : null}
        {record.isError ? (
          <div className="mt-6 border border-line bg-paper px-4 py-3 text-[12px]">
            <StatusText tone="err">could not read this name's records.</StatusText>{" "}
            <span className="text-ink-muted">the {recordsChain.label} RPC did not answer. nothing is wrong with the name; </span>
            <button type="button" className="link-blue text-ink" onClick={() => record.refetch()}>try again</button>
            <span className="text-ink-muted">. ({(record.error as Error).message.split("\n")[0].slice(0, 120)})</span>
          </div>
        ) : null}

        {data?.resolver || record.isLoading ? (
          <Figure n={1} name={`profile · ${name}`} className="mt-8" padded={false} dotted={false}>
            {editingProfile ? (
              <RecordEditor
                recordsChainId={recordsChainId}
                set={profile.set}
                drafts={drafts}
                enabled={isConnected && profileWritable}
                disabledReason={!isConnected ? "connect a wallet to edit." : !profileWritable ? "this name's resolver does not accept record writes from this app." : undefined}
                onDone={() => setEditingProfile(false)}
              />
            ) : (
              <>
                <ProfileCard name={name} profile={profile.data} loading={profile.isLoading || record.isLoading} consented={consented} />
                {isConnected && !record.isLoading ? (
                  <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2.5 sm:px-5">
                    <Button
                      size="sm"
                      variant="accent"
                      disabled={!data?.supportsData && !data?.resolver}
                      onClick={() => (data?.supportsData ? setDialog({ open: true }) : document.getElementById("publish")?.scrollIntoView({ behavior: "smooth", block: "start" }))}
                    >
                      + verify an account
                    </Button>
                    <Button size="sm" variant="outline" disabled={!profileWritable} onClick={() => setEditingProfile(true)}>
                      edit records
                    </Button>
                    {drafts.profileCount > 0 ? (
                      <span className="text-[12px] text-ink-muted">
                        {drafts.profileCount} {drafts.profileCount === 1 ? "change" : "changes"} waiting · <a className="link-blue text-ink" href="#publish">publish below</a>
                      </span>
                    ) : !profileWritable ? (
                      <span className="t-caption normal-case tracking-normal">this name's resolver does not accept record writes from this app.</span>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </Figure>
        ) : null}
        {profile.data?.source === "bigname" ? (
          <p className="t-caption mt-2 normal-case tracking-normal">
            profile indexed by <a className="link-blue" href="https://bigname.sh" target="_blank" rel="noreferrer">bigname</a>{profile.data.asOfBlock ? ` · as of block ${profile.data.asOfBlock.toLocaleString()}` : ""} · owned accounts are read and verified onchain
          </p>
        ) : null}

        <Figure n={2} name={`owned accounts · ${name}`} className="mt-6" padded={false} dotted={false}>
          {loading ? (
            <AccountsTableSkeleton />
          ) : record.isError ? (
            <div className="t-fig-body px-5 py-10 text-center text-ink-dim">waiting for the network…</div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="t-fig-title">Nothing on the record yet</div>
              <p className="t-fig-body mx-auto mt-2 max-w-[48ch]">
                {canEdit ? "add the wallet you are connected with below, then publish from the owner wallet." : "if this is your name, connect a wallet below to add your first account."}
              </p>
            </div>
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

        <StatRow
          className="mt-4"
          stats={[
            { label: "on the record", value: loading ? "…" : String(total) },
            { label: "verified", value: loading ? "…" : `${verified.length}/${total}` },
            { label: "chains", value: loading ? "…" : String(chainCount) },
            { label: "next expiry", value: nextExpiry ? `${daysUntil(nextExpiry)} days` : "—", hint: nextExpiry ? fmtDate(nextExpiry) : undefined },
          ]}
        />

        <div className="mt-6 border-t border-line">
          <FaqRow q="what do the statuses mean?">
            <ul className="space-y-2">
              {statusHelp.map((h) => (
                <li key={h.status} className="flex flex-wrap items-center gap-3">
                  <StatusMark status={h.status} />
                  <span>{h.text}</span>
                </li>
              ))}
            </ul>
          </FaqRow>
          <FaqRow q="can i send funds to these accounts?">
            No. An owned account is an identity claim, not a payment address. The standard says clients must not show the name in place of the address and should not send funds to owned accounts. Use the name's address records to pay it.
          </FaqRow>
          {data?.capabilities && data.supportsData ? (
            <FaqRow q="where is this stored?">
              On the name's own resolver,{" "}
              <a className="link-blue" href={`${explorer}/address/${data.resolver}`} target="_blank" rel="noreferrer">{shortAddr(data.resolver!)}</a>{" "}
              ({data.capabilities.writeFlavour === "name" ? "an ENSv2 permissioned resolver" : data.capabilities.canModifyName ? "the ENSv2 public resolver" : "a v1-style resolver"}), as ENSIP-24 data records, read through the Universal Resolver.
              {" "}Data support was {data.capabilities.erc165Data ? "advertised via ERC-165" : "detected by probing the resolver"}.
            </FaqRow>
          ) : null}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- manage */}
      <Section>
        <SectionHeader
          eyebrow="manage"
          title="Put an account on the record"
          lede="Three steps. Each account signs its own consent; the name owner publishes. Profile edits made above are published here too, in the same transaction."
        />
        <Figure n={3} name="publish" padded={false} dotted={false} id="publish">
          <div className="grid divide-y divide-line lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {/* step 1 */}
            <div className="p-5">
              <div className="flex items-baseline gap-3">
                <span className="text-[11px] text-blue">01</span>
                <span className="t-fig-title">Connect</span>
              </div>
              <p className="t-fig-body mt-2">Connect the wallet you want to list. To publish, connect the wallet that owns {name}.</p>
              <div className="mt-4">
                {!isConnected ? (
                  <ConnectButton />
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="dot text-ok" />
                    <span className="tabular font-semibold">{shortAddr(address!, 6)}</span>
                    {authority.isLoading ? (
                      <span className="text-ink-dim">· checking permissions…</span>
                    ) : canPublish ? (
                      <LivePill pulse={false}>{authority.data?.via === "owner" ? "owner" : "can publish"}</LivePill>
                    ) : (
                      <span className="text-ink-dim">· can sign, cannot publish</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* step 2 */}
            <div className="p-5">
              <div className="flex items-baseline gap-3">
                <span className="text-[11px] text-blue">02</span>
                <span className="t-fig-title">Sign a consent</span>
              </div>
              <p className="t-fig-body mt-2">The connected wallet signs a message saying it belongs to {name}. Switch wallets and repeat for each account.</p>
              <div className="mt-4">
                <Button variant={isConnected && pendingCount === 0 ? "accent" : "outline"} disabled={!isConnected || !data?.supportsData} onClick={() => setDialog({ open: true })}>
                  + add connected wallet
                </Button>
                {isConnected && !data?.supportsData ? <div className="t-caption mt-2 normal-case tracking-normal">this name's resolver cannot store records yet.</div> : null}
              </div>
            </div>
            {/* step 3 */}
            <div className="p-5">
              <div className="flex items-baseline gap-3">
                <span className="text-[11px] text-blue">03</span>
                <span className="t-fig-title">Publish</span>
              </div>
              <p className="t-fig-body mt-2">
                {pendingCount === 0 ? "Nothing waiting. Signed consents, removals and record edits collect here until you publish." : `${pendingCount} ${pendingCount === 1 ? "change" : "changes"} waiting. Publishing writes all of them in one transaction.`}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  variant={pendingCount > 0 ? "accent" : "outline"}
                  disabled={!canPublish || pendingCount === 0 || !data?.resolver || !canWriteAll || sending || receipt.isLoading}
                  onClick={publish}
                >
                  {sending ? "confirm in wallet…" : receipt.isLoading ? "mining…" : pendingCount > 0 ? `publish ${pendingCount} ${pendingCount === 1 ? "change" : "changes"}` : "publish"}
                </Button>
                {isConnected && pendingCount > 0 && !canPublish && !authority.isLoading ? (
                  <span className="t-caption normal-case tracking-normal">connect the owner wallet to publish.</span>
                ) : null}
              </div>
              {txHash ? (
                <div className="mt-3 text-[11px]">
                  {receipt.isSuccess ? <StatusText tone="ok">published</StatusText> : receipt.isLoading ? <StatusText tone="wait">mining</StatusText> : <StatusText tone="dim">sent</StatusText>}{" "}
                  <a className="link-blue text-ink-dim" href={`${explorer}/tx/${txHash}`} target="_blank" rel="noreferrer">{shortAddr(txHash, 6)}</a>
                </div>
              ) : null}
            </div>
          </div>

          {pendingCount > 0 ? (
            <div className="border-t border-line">
              <div className="t-label px-5 py-2 text-ink-dim">waiting to be published</div>
              <ul className="divide-y divide-line-soft border-t border-line-soft px-5 text-[12px]">
                {drafts.adds.map((d) => (
                  <li key={`a:${d.chainId}:${d.account}`} className="flex flex-wrap items-center gap-3 py-2.5">
                    <StatusMark status="draft" />
                    <span className="tabular font-semibold">{shortAddr(d.account, 6)}</span>
                    <span className="text-ink-dim">{chainById(d.chainId)?.label} · valid until {fmtDate(BigInt(d.expiresAt))}</span>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => drafts.dropDraft(d)}>discard</Button>
                  </li>
                ))}
                {drafts.removals.map((r) => (
                  <li key={`r:${r.chainId}:${r.account}`} className="flex flex-wrap items-center gap-3 py-2.5">
                    <StatusMark status="removing" />
                    <span className="tabular font-semibold">{shortAddr(r.account, 6)}</span>
                    <span className="text-ink-dim">{chainById(r.chainId)?.label}</span>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => drafts.unmarkRemoval(r)}>undo</Button>
                  </li>
                ))}
                {Object.entries(drafts.records).map(([id, value]) => {
                  const def = defFromId(id)
                  if (!def) return null
                  const clearing = value === "" || value === "0x"
                  const label = def.kind === "address" ? `${addressLabel(def.arg as number, recordsChainId).label} address` : def.kind === "text" ? def.label : def.longName ?? def.label
                  const shown = clearing ? "clear" : decodeValue(def, value)
                  return (
                    <li key={`rec:${id}`} className="flex flex-wrap items-center gap-3 py-2.5">
                      <StatusMark status={clearing ? "removing" : "draft"} />
                      <span className="font-semibold">{label}</span>
                      <span className={`min-w-0 flex-1 truncate text-ink-dim ${def.kind === "address" ? "tabular" : ""}`}>{def.kind === "address" && !clearing && shown.length > 20 ? shortAddr(shown, 6) : shown}</span>
                      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => drafts.setRecord(id, null)}>discard</Button>
                    </li>
                  )
                })}
                {drafts.links.map((l) => (
                  <li key={`l:${l.sourceName}`} className="flex flex-wrap items-center gap-3 py-2.5">
                    <StatusMark status={l.recordId === "0" ? "removing" : "draft"} />
                    <span className="font-semibold">link</span>
                    <span className="min-w-0 flex-1 truncate text-ink-dim">{l.scope}</span>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => drafts.dropLink(l)}>discard</Button>
                  </li>
                ))}
                {drafts.access.map((c) => (
                  <li key={`g:${c.account}:${c.resource}:${c.revoke}`} className="flex flex-wrap items-center gap-3 py-2.5">
                    <StatusMark status={c.revoke ? "removing" : "draft"} />
                    <span className="font-semibold">{c.revoke ? "revoke" : "allow"} {shortAddr(c.account, 6)}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-dim">{c.scope}</span>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => drafts.dropAccess(c)}>discard</Button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-end border-t border-line-soft px-5 py-2">
                <Button size="sm" variant="ghost" onClick={drafts.clear}>discard all</Button>
              </div>
            </div>
          ) : null}
        </Figure>

        <div className="mt-6 border-t border-line">
          <FaqRow q="technical details: what gets written">
            <Figure name="records on the resolver" padded={false} className="mt-1">
              <Code lines={[
                [c(`# resolver ${data?.resolver ? shortAddr(data.resolver) : "0x…"} · ${recordsChain.label}`)],
                [k("accounts-chains"), p(": "), s(`[${Array.from(new Set([...onChain.map((a) => a.chainId), ...drafts.adds.map((d) => d.chainId)])).join(", ") || "…"}]`)],
                ...rows.filter((r) => r.pending !== "remove").slice(0, 4).map((r) => [k(`accounts[${r.chainId}]`), p(" ∋ "), s(shortAddr(r.account, 6))]),
                ...rows.filter((r) => r.pending !== "remove").slice(0, 2).map((r) => [k(`accounts[${r.chainId}][${shortAddr(r.account, 3)}]`), p(": "), s(`(${r.expiresAt ?? "expiresAt"}, sig)`)]),
              ]} />
            </Figure>
            <p className="t-caption mt-2 normal-case tracking-normal">
              verification: ERC-1271 for contracts, ecrecover for wallets, expiry at most two years. written with one <code>multicall</code> of {data?.capabilities?.writeFlavour === "name" ? "setData(name, key, value)" : "setData(node, key, value)"}.
            </p>
          </FaqRow>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- shared records */}
      {hasLinks ? (
        <Section>
          <SectionHeader
            eyebrow="shared records"
            title="One record, many names"
            lede={`On ENSv2 every name on this resolver reads a record, and records can be shared. Point a second name at ${name}'s record and both show the same profile, addresses and owned accounts. Set a default record and every name without one falls back to it.`}
          />
          <Figure n={4} name={`records · ${data?.resolver ? shortAddr(data.resolver) : ""}`} padded={false} dotted={false}>
            <SharedFigure
              name={name}
              recordsChainId={recordsChainId}
              rows={links.data?.rows}
              indexed={links.data?.indexed ?? hasBigName(recordsChainId)}
              loading={links.isLoading}
              canLink={canLink}
              staged={drafts.links}
              onShare={() => setLinkOpen(true)}
              onStage={drafts.addLink}
            />
          </Figure>
          {drafts.linkCount > 0 ? (
            <p className="t-caption mt-3 normal-case tracking-normal">
              {drafts.linkCount} link {drafts.linkCount === 1 ? "change" : "changes"} waiting · <a className="link-blue text-ink" href="#publish">publish above</a>
            </p>
          ) : isConnected && !canLink && !linkAuthority.isLoading ? (
            <p className="t-caption mt-3 normal-case tracking-normal">linking needs the resolver's link role · connect the owner wallet.</p>
          ) : null}
          <div className="mt-6 border-t border-line">
            <FaqRow q="what happens to the record a name leaves?">
              Nothing. Records are never deleted; a link only changes which record a name reads. A name that leaves a record shows the default record if one is set, otherwise nothing until its next edit, which starts a fresh record for it.
            </FaqRow>
            <FaqRow q="do owned accounts travel with a shared record?">
              The records do, but each consent was signed for one name. A consent signed for {name} verifies only under {name}, so other names sharing the record show those accounts as invalid until their owners sign again for that name.
            </FaqRow>
          </div>
        </Section>
      ) : null}

      {/* ---------------------------------------------------------------- access */}
      {hasRoles ? (
        <Section>
          <SectionHeader
            eyebrow="access"
            title={`Who can edit ${name}`}
            lede="ENSv2 resolvers grant rights per record type and per key. Let a teammate, an agent or a service change one record without handing over the name."
          />
          <Figure n={hasLinks ? 5 : 4} name={`access · who can edit ${name}`} padded={false} dotted={false}>
            <AccessFigure
              name={name}
              recordsChainId={recordsChainId}
              rows={resolverRoles.data}
              loading={resolverRoles.isLoading}
              indexed={hasBigName(recordsChainId)}
              connected={address}
              canAdmin={canAdmin}
              staged={drafts.access}
              extraKeys={stagedTextKeys}
              onGrant={() => setGrantOpen(true)}
              onRevoke={drafts.addAccess}
            />
          </Figure>
          {drafts.accessCount > 0 ? (
            <p className="t-caption mt-3 normal-case tracking-normal">
              {drafts.accessCount} access {drafts.accessCount === 1 ? "change" : "changes"} waiting · <a className="link-blue text-ink" href="#publish">publish above</a>
            </p>
          ) : null}
        </Section>
      ) : null}

      <GrantDialog open={grantOpen} onOpenChange={setGrantOpen} name={name} recordsChainId={recordsChainId} onStage={drafts.addAccess} />
      {data?.resolver ? (
        <LinkDialog open={linkOpen} onOpenChange={setLinkOpen} name={name} recordsChainId={recordsChainId} resolver={data.resolver} myRecordId={myRecordId} defaultRecordId={defaultRecordId} onStage={drafts.addLink} />
      ) : null}
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
