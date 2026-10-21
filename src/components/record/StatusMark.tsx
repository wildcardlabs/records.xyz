import { CircleDashed, Clock3, PenLine, Trash2, X, type LucideIcon } from "lucide-react"
import { cn } from "cn"
import type { ProofStatus } from "@/lib/ensip28"

export type RowStatus = ProofStatus | "draft" | "removing"

/** Scalloped verified seal in olive with a white check: shown on a payment address that also signed a live owned-account consent on its chain. */
function VerifiedSeal({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12.00 1.40 L14.30 3.40 L17.30 2.82 L18.29 5.71 L21.18 6.70 L20.60 9.70 L22.60 12.00 L20.60 14.30 L21.18 17.30 L18.29 18.29 L17.30 21.18 L14.30 20.60 L12.00 22.60 L9.70 20.60 L6.70 21.18 L5.71 18.29 L2.82 17.30 L3.40 14.30 L1.40 12.00 L3.40 9.70 L2.82 6.70 L5.71 5.71 L6.70 2.82 L9.70 3.40 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7.6 12.4l2.9 2.9 5.9-6.1" fill="none" stroke="var(--bg)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}



type Tone = "ok" | "wait" | "err" | "dim" | "blue"

type IconComponent = LucideIcon | typeof VerifiedSeal

const spec: Record<RowStatus, { icon: IconComponent; tone: Tone; label: string; short: string }> = {
  verified: { icon: VerifiedSeal, tone: "ok", label: "verified", short: "consent checked on chain" },
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
          <Icon className="size-5" {...(Icon === VerifiedSeal ? {} : { strokeWidth: 2.5 })} />
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
        <Icon className="size-3.5" {...(Icon === VerifiedSeal ? {} : { strokeWidth: 2.75 })} />
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

export { StatusMark, VerifiedSeal, statusHelp, spec as statusSpec }
