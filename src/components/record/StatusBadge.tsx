import { Badge } from "@/components/ui/badge"
import type { ProofStatus } from "@/lib/ensip28"

export type RowStatus = ProofStatus | "draft" | "removing"

const map: Record<RowStatus, { variant: "ok" | "wait" | "err" | "pill" | "blue"; label: string }> = {
  verified: { variant: "ok", label: "verified" },
  expiring: { variant: "wait", label: "expiring" },
  expired: { variant: "err", label: "expired" },
  invalid: { variant: "err", label: "invalid" },
  unverified: { variant: "pill", label: "unverified" },
  draft: { variant: "blue", label: "draft" },
  removing: { variant: "err", label: "removing" },
}

function StatusBadge({ status }: { status: RowStatus }) {
  const m = map[status]
  return <Badge variant={m.variant}>{m.label}</Badge>
}

export { StatusBadge }
