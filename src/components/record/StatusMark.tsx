import { Check, CircleDashed, Clock3, PenLine, Trash2, X, type LucideIcon } from "lucide-react"
import { cn } from "cn"
import type { ProofStatus } from "@/lib/ensip28"

export type RowStatus = ProofStatus | "draft" | "removing"

type Tone = "ok" | "wait" | "err" | "dim" | "blue"

const spec: Record<RowStatus, { icon: LucideIcon; tone: Tone; label: string; short: string }> = {
  verified: { icon: Check, tone: "ok", label: "verified", short: "consent checked on chain" },
  expiring: { icon: Clock3, tone: "wait", label: "verified · expiring", short: "renew before it lapses" },
  expired: { icon: X, tone: "err", label: "expired", short: "consent lapsed" },
  invalid: { icon: X, tone: "err", label: "invalid", short: "signature does not verify" },
  unverified: { icon: CircleDashed, tone: "dim", label: "unverified", short: "listed without a proof" },
  draft: { icon: PenLine, tone: "blue", label: "draft", short: "signed · not published yet" },
  removing: { icon: Trash2, tone: "err", label: "removing", short: "gone after publish" },
}

const toneClass: Record<Tone, string> = {
  ok: "border-ok text-ok",
  wait: "border-wait text-wait",
  err: "border-err text-err",
  dim: "border-line text-ink-dim",
  blue: "border-blue text-blue",
}

/**
 * The verified mark: a square-cornered outlined rectangle with an icon cell and a lowercase label.
 * `lg` adds a second line and is used for the page-level summary.
 */
function StatusMark({ status, size = "sm", detail, className }: { status: RowStatus; size?: "sm" | "lg"; detail?: string; className?: string }) {
  const s = spec[status]
  const Icon = s.icon
  if (size === "lg") {
    return (
      <div className={cn("inline-flex items-stretch border bg-paper", toneClass[s.tone], className)}>
        <div className={cn("flex items-center border-r px-3", toneClass[s.tone])}>
          <Icon className="size-5" strokeWidth={2.5} />
        </div>
        <div className="px-3 py-2">
          <div className="font-mono text-[14px] font-semibold lowercase leading-tight">{s.label}</div>
          <div className="t-caption mt-0.5 normal-case tracking-normal">{detail ?? s.short}</div>
        </div>
      </div>
    )
  }
  return (
    <span className={cn("inline-flex items-center border bg-paper font-mono text-[11px] font-semibold lowercase leading-none", toneClass[s.tone], className)}>
      <span className={cn("flex items-center border-r px-1.5 py-[5px]", toneClass[s.tone])}>
        <Icon className="size-3" strokeWidth={2.75} />
      </span>
      <span className="px-2 py-[5px]">{s.label}</span>
    </span>
  )
}

const statusHelp: { status: RowStatus; text: string }[] = [
  { status: "verified", text: "the account signed a consent for this name and the signature checks out on its chain." },
  { status: "expiring", text: "verified, but the consent lapses within 30 days. the owner can renew it." },
  { status: "expired", text: "the consent's expiry has passed. the account is no longer an owned account." },
  { status: "invalid", text: "the proof exists but its signature does not verify for this account, name and chain." },
  { status: "unverified", text: "the name lists the account but no proof record exists for it." },
  { status: "draft", text: "a consent was signed in this browser and is waiting for the owner to publish." },
]

export { StatusMark, statusHelp, spec as statusSpec }
