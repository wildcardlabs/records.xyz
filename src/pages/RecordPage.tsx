import { useMemo, useState } from "react"
import { CalendarPlus, Copy, RefreshCw } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useConnection } from "wagmi"
import type { Address, Hex } from "viem"
import { normalize } from "viem/ens"
import { Button } from "@/components/ui/button"
import { Eyebrow, Figure, Section, SectionHeader, StatRow, StatusText, Code, FaqRow, k, s, c, p } from "@/components/wrap"
import { AccountsTableSkeleton } from "@/components/record/AccountsTable"
import { StatusMark, statusHelp } from "@/components/record/StatusMark"
import { ConnectButton } from "@/components/wallet/ConnectButton"
import { MyNameChips } from "@/components/wallet/MyNames"
import { AccountsTable, type Row } from "@/components/record/AccountsTable"
import { AddAccountDialog } from "@/components/record/AddAccountDialog"
import { useRecord, recordQueryKey } from "@/hooks/useRecord"
import { useNameOwner } from "@/hooks/useNameOwner"
import { useProfile } from "@/hooks/useProfile"
import { ProfileCard } from "@/components/record/ProfileCard"
import { RecordEditor } from "@/components/record/RecordEditor"
import { AccessFigure } from "@/components/record/AccessFigure"
import { GrantDialog } from "@/components/record/GrantDialog"
import { SharedFigure, effectiveRecord } from "@/components/record/SharedFigure"
import { LinkDialog } from "@/components/record/LinkDialog"
import { PrimaryDialog } from "@/components/record/PrimaryDialog"
import { HistoryFigure } from "@/components/record/HistoryFigure"
import { usePrimaryNamesFor } from "@/hooks/usePrimaryNames"
import { targetForCoin } from "@/lib/ens/primary"
import { useResolverLinks, linksQueryKey } from "@/hooks/useResolverLinks"
import { siblingsOf } from "@/lib/ens/links"
import { useResolverRoles } from "@/hooks/useResolverRoles"
import { adminBitsFor } from "@/lib/ens/roles"
import { hasBigName } from "@/lib/ens/bigname"
import { usePublishAuthority } from "@/hooks/usePublishAuthority"
import { useDrafts } from "@/hooks/useDrafts"
import { chainById, DEFAULT_RECORDS_CHAIN } from "@/lib/ens/chains"
import type { PublishPlan } from "@/lib/ens/write"
import { type PublishGroup, usePublisher } from "@/hooks/usePublisher"
import { type PendingRow, PublishPanel, type PublishState } from "@/components/record/PublishPanel"
import { isOwned } from "@/lib/ensip28"
import { addressLabel } from "@/lib/ens/profile"
import { COIN_TYPE_DEFAULT, chainIdForCoinType, decodeValue, defFromId } from "@/lib/records"
import { daysUntil, fmtDate, sameAddr, shortAddr } from "@/lib/format"

export default function RecordPage() {
  const { name: rawName = "" } = useParams()
  const recordsChain = DEFAULT_RECORDS_CHAIN
  const recordsChainId = recordsChain.chain.id

  let name: string | null = null
  try {
    name = normalize(rawName)
  } catch {
    name = null
  }

  const record = useRecord(name ?? undefined, recordsChainId)
  const owner = useNameOwner(name ?? undefined, recordsChainId)
  const drafts = useDrafts(name ?? undefined, recordsChainId)
  const { address, isConnected } = useConnection()
  const qc = useQueryClient()
  const [dialog, setDialog] = useState<{ open: boolean; chainId?: number }>({ open: false })
  const [editingProfile, setEditingProfile] = useState(false)
  const [grantOpen, setGrantOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [primaryOpen, setPrimaryOpen] = useState(false)

  const data = record.data
  const auth = (needs: Parameters<typeof usePublishAuthority>[7]) =>
    usePublishAuthority(name ?? undefined, recordsChainId, data?.resolver, data?.capabilities, address, owner.data?.owner, owner.data?.manager, needs)
  // each section publishes its own group, so each asks for exactly the roles its writes need
  const stagedKinds = useMemo(() => new Set(Object.keys(drafts.records).map((id) => defFromId(id)?.kind)), [drafts.records])
  const stagedTextKeys = useMemo(() => Object.keys(drafts.records).filter((id) => id.startsWith("text:")).map((id) => id.slice(5)), [drafts.records])
  const adminBits = drafts.access.reduce((acc, c) => acc | adminBitsFor(c), 0n)
  const accountsAuthority = auth({ data: true })
  const recordsAuthority = auth({
    data: stagedKinds.has("data"),
    text: stagedKinds.has("text"),
    addr: stagedKinds.has("address"),
    contenthash: stagedKinds.has("contenthash"),
    abi: stagedKinds.has("abi"),
    interface: stagedKinds.has("interface"),
  })
  const accessAuthority = auth({ adminBits: adminBits ? adminBits.toString() : undefined })
  const linkAuthority = auth({ link: true })
  // may the connected wallet change any profile record? (v1: owner or manager; v2: a text or address role)
  const editTextAuthority = auth({ text: true })
  const editAddrAuthority = auth({ addr: true })
  const canEditProfile = !!(editTextAuthority.data?.canPublish || editAddrAuthority.data?.canPublish)
  const checkingEdit = editTextAuthority.isLoading || editAddrAuthority.isLoading
  const canPublish = accountsAuthority.data?.canPublish ?? false
  const profileWritable = !!data?.capabilities?.profileWrite
  const hasLinks = !!data?.capabilities?.links
  const hasRoles = !!data?.capabilities?.roles
  const isV2 = !!data?.capabilities && (data.capabilities.writeFlavour === "name" || data.capabilities.canModifyName || data.capabilities.roles)
  const publisher = usePublisher(name ?? undefined, recordsChainId, data?.resolver, { data: data?.capabilities?.writeFlavour ?? "node", profile: data?.capabilities?.profileWrite ?? "node" })
  const stateFor = (group: PublishGroup): PublishState => ({
    sending: publisher.sending && publisher.active === group,
    mining: publisher.mining && publisher.active === group,
    blocked: publisher.busy && publisher.active !== group,
    txHash: publisher.active === group ? publisher.txHash : undefined,
    mined: publisher.active === group && publisher.mined,
  })
  const links = useResolverLinks(name ?? undefined, recordsChainId, data?.resolver, hasLinks)
  const siblings = useMemo(() => siblingsOf(links.data?.rows, name ?? ""), [links.data, name])
  // on ENSv2 the profile may be shared and the indexer may lag a link: read values from the chain
  const profile = useProfile(name ?? undefined, recordsChainId, Object.keys(drafts.records), { chainFirst: hasLinks, keyNames: siblings })
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
          reason: removing ? "removed on publish" : draft ? "signed · publish to write" : a.check.reason,
          expiresAt: draft ? BigInt(draft.expiresAt) : a.check.expiresAt,
          pending: removing ? "remove" : draft ? "add" : undefined,
        })
      }
    }
    for (const d of drafts.adds) {
      if (out.some((r) => r.chainId === d.chainId && sameAddr(r.account, d.account))) continue
      out.push({ chainId: d.chainId, account: d.account, kind: d.kind, status: "draft", reason: "signed · publish to write", expiresAt: BigInt(d.expiresAt), pending: "add" })
    }
    return out.sort((x, y) => x.chainId - y.chainId || x.account.localeCompare(y.account))
  }, [data, drafts.adds, drafts.removals])

  const onChain = data?.chains.flatMap((c) => c.accounts) ?? []
  const verified = onChain.filter((a) => isOwned(a.check.status))
  // payment address ↔ owned account match, bound to the chain the consent names
  const consentedKeys = useMemo(() => new Set(verified.map((a) => `${a.chainId}:${a.account.toLowerCase()}`)), [verified])
  const consented = (coinType: number, addr: string) => {
    // the default address stands for every EVM chain: a consent on any chain marks it
    if (coinType === COIN_TYPE_DEFAULT) return verified.some((a) => a.account.toLowerCase() === addr.toLowerCase())
    const chainId = coinType === 60 ? 1 : chainIdForCoinType(coinType)
    return chainId !== null && consentedKeys.has(`${chainId}:${addr.toLowerCase()}`)
  }
  // does each payment address point back at this name as its primary, per chain?
  const cardAddresses = useMemo(() => [...new Set((profile.data?.addresses ?? []).filter((a) => a.evm).map((a) => a.address.toLowerCase() as Address))], [profile.data])
  const primaryQueries = usePrimaryNamesFor(cardAddresses, recordsChainId)
  const primaryFor = (coinType: number, addr: string): string | null => {
    const i = cardAddresses.indexOf(addr.toLowerCase() as Address)
    const rows = i >= 0 ? primaryQueries[i]?.data : undefined
    const target = targetForCoin(coinType, recordsChainId)
    if (!rows || !target) return null
    const row = rows.find((r) => r.target.kind === target.kind && r.target.chain.id === target.chain.id)
    return row && row.name === name ? target.label : null
  }
  const nextExpiry = verified.map((a) => a.check.expiresAt!).sort((a, b) => (a < b ? -1 : 1))[0]
  const chainCount = new Set(onChain.map((a) => a.chainId)).size

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: recordQueryKey(name ?? "", recordsChainId) })
    qc.invalidateQueries({ queryKey: ["profile", recordsChainId, name] })
    qc.invalidateQueries({ queryKey: ["resolver-roles", recordsChainId] })
    qc.invalidateQueries({ queryKey: linksQueryKey(recordsChainId, data?.resolver) })
  }
  const publishGroup = (group: PublishGroup, plan: PublishPlan) =>
    publisher.publish(group, plan, () => {
      drafts.clearGroup(group)
      refetchAll()
    })

  function publishAccounts() {
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
    void publishGroup("accounts", plan)
  }
  const empty: PublishPlan = { listings: {}, proofs: [], removals: [] }
  const publishRecords = () => publishGroup("records", { ...empty, records: drafts.records })
  const publishAccess = () => publishGroup("access", { ...empty, access: drafts.access })
  const publishLinks = () => publishGroup("links", { ...empty, links: drafts.links })

  // pending rows per group, each discardable where it was staged
  const accountRows: PendingRow[] = [
    ...drafts.adds.map((d) => ({ key: `a:${d.chainId}:${d.account}`, status: "draft" as const, label: shortAddr(d.account, 6), address: d.account, detail: `${chainById(d.chainId)?.label} · valid until ${fmtDate(BigInt(d.expiresAt))}`, tabular: true, onDiscard: () => drafts.dropDraft(d) })),
    ...drafts.removals.map((r) => ({ key: `r:${r.chainId}:${r.account}`, status: "removing" as const, label: shortAddr(r.account, 6), address: r.account, detail: `${chainById(r.chainId)?.label} · remove`, tabular: true, onDiscard: () => drafts.unmarkRemoval(r) })),
  ]
  const recordRows: PendingRow[] = Object.entries(drafts.records).flatMap(([id, value]) => {
    const def = defFromId(id)
    if (!def) return []
    const clearing = value === "" || value === "0x"
    const label = def.kind === "address" ? `${addressLabel(def.arg as number, recordsChainId).label} address` : def.kind === "text" ? def.label : def.longName ?? def.label
    const shown = clearing ? "clear" : decodeValue(def, value)
    return [{ key: `rec:${id}`, status: clearing ? ("removing" as const) : ("draft" as const), label, detail: def.kind === "address" && !clearing && shown.length > 20 ? shortAddr(shown, 6) : shown, tabular: def.kind === "address", onDiscard: () => drafts.setRecord(id, null) }]
  })
  const accessRows: PendingRow[] = drafts.access.map((c) => ({ key: `g:${c.account}:${c.resource}:${c.revoke}`, status: c.revoke ? ("removing" as const) : ("draft" as const), label: `${c.revoke ? "revoke" : "allow"} ${shortAddr(c.account, 6)}`, detail: c.scope, onDiscard: () => drafts.dropAccess(c) }))
  const linkRows: PendingRow[] = drafts.links.map((l) => ({ key: `l:${l.sourceName}`, status: l.recordId === "0" ? ("removing" as const) : ("draft" as const), label: "link", detail: l.scope, onDiscard: () => drafts.dropLink(l) }))

  if (!name) {
    return (
      <Section>
        <SectionHeader eyebrow="record" title="That is not a valid ENS name" lede={`"${rawName}" can't be an ENS name. Check the spelling and the ending, like alice.eth.`} />
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
  const pendingCount = drafts.accountCount
  const canAddAccount = !!data?.supportsData
  const openAdd = (chainId?: number) => setDialog({ open: true, chainId })

  return (
    <>
      {/* ---------------------------------------------------------------- the record */}
      <Section>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="t-eyebrow"># record · {recordsChain.label}{isV2 ? " · ensv2" : data?.resolver && !record.isLoading ? " · ensv1" : ""}</div>
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
                      ? `${total} ${total === 1 ? "wallet" : "wallets"} across ${chainCount} ${chainCount === 1 ? "chain" : "chains"}`
                      : `${verified.length} of ${total} wallets verified`
                  }
                />
              ) : record.isError ? (
                <StatusMark size="lg" status="unverified" detail={`could not reach ${recordsChain.label}`} />
              ) : data?.resolver ? (
                <StatusMark size="lg" status="unverified" detail="no wallets on the record yet" />
              ) : (
                <StatusMark size="lg" status="invalid" detail={`no resolver on ${recordsChain.label}`} />
              )}
              {checkedAt ? (
                <button type="button" onClick={() => record.refetch()} className="link-blue inline-flex items-center gap-1.5 text-[11px] text-ink-dim">
                  <RefreshCw className={`size-3 ${record.isFetching ? "animate-spin" : ""}`} />
                  checked live at {checkedAt} · re-check
                </button>
              ) : null}
            </div>
            <MyNameChips exclude={{ name, chainId: recordsChainId }} />
          </div>
          <div className="flex flex-wrap items-start gap-2 sm:justify-end">
            {name && /^[^.]+\.eth$/.test(name) ? (
              <Button variant="outline" size="sm" render={<Link to={`/renew/${name}`} />}>
                <CalendarPlus data-icon="inline-start" /> extend
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(window.location.href); toast("link copied") }}>
              <Copy data-icon="inline-start" /> copy link
            </Button>
          </div>
        </div>

        {data?.chains.some((c) => c.malformed) ? (
          <p className="mt-4 text-[12px]"><StatusText tone="err">a malformed listing record was ignored.</StatusText></p>
        ) : null}
        {record.isError ? (
          <p className="mt-5 text-[12px]">
            <StatusText tone="err">could not read this name's records.</StatusText>{" "}
            <span className="text-ink-muted">the {recordsChain.label} RPC did not answer. </span>
            <button type="button" className="link-blue text-ink" onClick={() => record.refetch()}>try again</button>
          </p>
        ) : null}

        {/* fig 1 · profile */}
        {data?.resolver || record.isLoading ? (
          <Figure n={1} name={`profile · ${name}`} className="mt-8" padded={false} dotted={false}>
            {editingProfile ? (
              <RecordEditor
                recordsChainId={recordsChainId}
                set={profile.set}
                drafts={drafts}
                enabled={isConnected && profileWritable && canEditProfile}
                disabledReason={!isConnected ? "connect your wallet to edit." : !profileWritable ? "this name's resolver can't be edited here." : !canEditProfile ? `you can't edit ${name} with this wallet.` : undefined}
                onDone={() => setEditingProfile(false)}
              />
            ) : (
              <>
                <ProfileCard name={name} profile={profile.data} loading={profile.isLoading || record.isLoading} consented={consented} primary={primaryFor} />
                {isConnected && !record.isLoading ? (
                  <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2.5 sm:px-5">
                    <Button size="sm" variant="outline" disabled={!profileWritable || !canEditProfile || checkingEdit} onClick={() => setEditingProfile(true)}>
                      edit profile
                    </Button>
                    {address && cardAddresses.includes(address.toLowerCase() as Address) ? (
                      <Button size="sm" variant="outline" onClick={() => setPrimaryOpen(true)}>
                        set as my primary name
                      </Button>
                    ) : null}
                    {!profileWritable ? (
                      <span className="t-caption normal-case tracking-normal">this name's resolver can't be edited here.</span>
                    ) : checkingEdit ? (
                      <span className="t-caption normal-case tracking-normal">checking permissions…</span>
                    ) : !canEditProfile ? (
                      <span className="t-caption normal-case tracking-normal">you can't edit {name} with this wallet</span>
                    ) : null}
                  </div>
                ) : null}
                <PublishPanel
                  rows={recordRows}
                  onDiscardAll={() => drafts.clearGroup("records")}
                  count={drafts.profileCount}
                  what="profile change"
                  canPublish={recordsAuthority.data?.canPublish ?? false}
                  checking={recordsAuthority.isLoading}
                  capable={profileWritable}
                  incapableReason="this name's resolver can't be edited here."
                  explorer={explorer}
                  state={stateFor("records")}
                  onPublish={publishRecords}
                />
              </>
            )}
          </Figure>
        ) : null}
        {profile.data?.source === "bigname" ? (
          <p className="t-caption mt-2 normal-case tracking-normal">
            indexed by <a className="link-blue" href="https://bigname.sh" target="_blank" rel="noreferrer">bigname</a>{profile.data.asOfBlock ? ` · block ${profile.data.asOfBlock.toLocaleString()}` : ""}
          </p>
        ) : null}

        {/* fig 2 · wallets on the record */}
        <Figure n={2} name={`wallets on the record · ${name}`} className="mt-6" padded={false} dotted={false} id="accounts">
          <div className="border-b border-line px-4 py-2 sm:px-5">
            <span className="t-caption normal-case tracking-normal">wallets that have signed to say they belong to {name}</span>
          </div>
          {loading ? (
            <AccountsTableSkeleton />
          ) : record.isError ? (
            <div className="t-fig-body px-5 py-10 text-center text-ink-dim">waiting for the network…</div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="t-fig-body mx-auto max-w-[44ch]">
                {canEdit ? "Verify your wallet below. It shows here once the owner publishes." : `Connect your wallet to verify it belongs to ${name}.`}
              </p>
            </div>
          ) : (
            <AccountsTable
              rows={rows}
              canEdit={canEdit}
              onRemove={(r) => drafts.markRemoval({ chainId: r.chainId, account: r.account })}
              onUndo={(r) => (r.pending === "add" ? drafts.dropDraft({ chainId: r.chainId, account: r.account }) : drafts.unmarkRemoval({ chainId: r.chainId, account: r.account }))}
              onRenew={(r) => openAdd(r.chainId)}
            />
          )}
          {!record.isLoading && data?.resolver ? (
            <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2.5 sm:px-5">
              {isConnected ? (
                <>
                  <Button size="sm" variant="accent" disabled={!canAddAccount} onClick={() => openAdd()}>+ verify my wallet</Button>
                  <span className="t-caption normal-case tracking-normal">
                    {canAddAccount ? `signs with ${shortAddr(address!, 4)} · the owner publishes` : "this name's resolver doesn't support ENSIP-28."}
                  </span>
                </>
              ) : (
                <>
                  <ConnectButton />
                  <span className="t-caption normal-case tracking-normal">connect your wallet to verify it</span>
                </>
              )}
            </div>
          ) : null}
          <PublishPanel
            rows={accountRows}
            onDiscardAll={() => drafts.clearGroup("accounts")}
            count={pendingCount}
            what="consent"
            canPublish={canPublish}
            checking={accountsAuthority.isLoading}
            capable={canAddAccount}
            incapableReason="this name's resolver doesn't support ENSIP-28."
            explorer={explorer}
            state={stateFor("accounts")}
            onPublish={publishAccounts}
          />
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

        {/* fig 3 · history */}
        {hasBigName(recordsChainId) ? (
          <Figure n={3} name={`history · ${name}`} className="mt-6" padded={false} dotted={false}>
            <HistoryFigure name={name} recordsChainId={recordsChainId} explorer={explorer} enabled />
          </Figure>
        ) : null}
      </Section>

      {/* ---------------------------------------------------------------- shared profile (ENSv2) */}
      {hasLinks ? (
        <Section>
          <SectionHeader eyebrow="ensv2" title="Shared profile" />
          <Figure n={4} name={`shared profile · ${data?.resolver ? shortAddr(data.resolver) : ""}`} padded={false} dotted={false}>
            <SharedFigure
              name={name}
              rows={links.data?.rows}
              indexed={links.data?.indexed ?? hasBigName(recordsChainId)}
              loading={links.isLoading}
              canLink={canLink}
              staged={drafts.links}
              onShare={() => setLinkOpen(true)}
              onStage={drafts.addLink}
            />
            <PublishPanel
              rows={linkRows}
              onDiscardAll={() => drafts.clearGroup("links")}
              count={drafts.linkCount}
              what="link"
              canPublish={canLink}
              checking={linkAuthority.isLoading}
              capable={hasLinks}
              explorer={explorer}
              state={stateFor("links")}
              onPublish={publishLinks}
            />
          </Figure>
        </Section>
      ) : null}

      {/* ---------------------------------------------------------------- access (ENSv2) */}
      {hasRoles ? (
        <Section>
          <SectionHeader eyebrow="ensv2" title={`Who can edit ${name}`} />
          <Figure n={hasLinks ? 5 : 4} name={`access · ${name}`} padded={false} dotted={false}>
            <AccessFigure
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
            <PublishPanel
              rows={accessRows}
              onDiscardAll={() => drafts.clearGroup("access")}
              count={drafts.accessCount}
              what="access change"
              canPublish={accessAuthority.data?.canPublish ?? false}
              checking={accessAuthority.isLoading}
              capable={hasRoles}
              explorer={explorer}
              state={stateFor("access")}
              onPublish={publishAccess}
            />
          </Figure>
        </Section>
      ) : null}

      {/* ---------------------------------------------------------------- details: everything that is explanation */}
      <Section>
        <Eyebrow>details</Eyebrow>
        <div className="mt-3 border-t border-line">
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
          <FaqRow q="can i send funds to a wallet on the record?">
            No. Use the name's payment addresses. A wallet on the record only says it belongs to the name.
          </FaqRow>
          {data?.capabilities && data.supportsData ? (
            <FaqRow q="where is this stored?">
              On the name's resolver,{" "}
              <a className="link-blue" href={`${explorer}/address/${data.resolver}`} target="_blank" rel="noreferrer">{shortAddr(data.resolver!)}</a>.
            </FaqRow>
          ) : null}
          <FaqRow q="what gets written">
            <Figure name="records on the resolver" padded={false} className="mt-1">
              <Code lines={[
                [c(`# resolver ${data?.resolver ? shortAddr(data.resolver) : "0x…"} · ${recordsChain.label}`)],
                [k("accounts-chains"), p(": "), s(`[${Array.from(new Set([...onChain.map((a) => a.chainId), ...drafts.adds.map((d) => d.chainId)])).join(", ") || "…"}]`)],
                ...rows.filter((r) => r.pending !== "remove").slice(0, 4).map((r) => [k(`accounts[${r.chainId}]`), p(" ∋ "), s(shortAddr(r.account, 6))]),
                ...rows.filter((r) => r.pending !== "remove").slice(0, 2).map((r) => [k(`accounts[${r.chainId}][${shortAddr(r.account, 3)}]`), p(": "), s(`(${r.expiresAt ?? "expiresAt"}, sig)`)]),
              ]} />
            </Figure>
          </FaqRow>
          {hasLinks ? (
            <>
              <FaqRow q="what happens to the profile a name leaves?">
                It stays on the resolver. The name shows the default profile, or nothing, until you edit it again.
              </FaqRow>
              <FaqRow q="do wallets on the record travel with a shared profile?">
                They show on every name using the profile, but each signature names one ENS name and only verifies there.
              </FaqRow>
            </>
          ) : null}
        </div>
      </Section>

      <GrantDialog open={grantOpen} onOpenChange={setGrantOpen} name={name} recordsChainId={recordsChainId} onStage={drafts.addAccess} />
      <PrimaryDialog open={primaryOpen} onOpenChange={setPrimaryOpen} name={name} recordsChainId={recordsChainId} />
      {data?.resolver ? (
        <LinkDialog open={linkOpen} onOpenChange={setLinkOpen} name={name} recordsChainId={recordsChainId} resolver={data.resolver} myRecordId={myRecordId} defaultRecordId={defaultRecordId} bound={links.data?.rows} onStage={drafts.addLink} />
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
